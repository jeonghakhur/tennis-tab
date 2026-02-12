'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { Building2, Users, Shield, MapPin, Search } from 'lucide-react'
import { DeleteAssociationButton } from './DeleteAssociationButton'
import { matchesKoreanSearch } from '@/lib/utils/korean'
import type { AssociationWithCounts } from '@/app/admin/associations/page'

interface Props {
  associations: AssociationWithCounts[]
}

/** SUPER_ADMIN 전용: 협회 목록 + 초성 검색 */
export function AssociationList({ associations }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // 로컬 state로 즉각 반응, URL은 blur 시 동기적으로 동기화
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')

  // 입력 필드 blur 시 URL 동기화 (동기적, 서버 refetch 없음)
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
    if (!searchQuery) return associations
    return associations.filter((a) =>
      matchesKoreanSearch(a.name, searchQuery) ||
      (a.region && matchesKoreanSearch(a.region, searchQuery)) ||
      (a.district && matchesKoreanSearch(a.district, searchQuery)),
    )
  }, [associations, searchQuery])

  return (
    <div className="space-y-4">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
        <input
          type="text"
          placeholder="협회명, 지역으로 검색 (초성 검색 지원: ㅅㅊ → 서초)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={syncUrlOnBlur}
          aria-label="협회 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-secondary) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent-color) focus:outline-none transition-colors"
        />
      </div>

      {/* 결과 카운트 */}
      {searchQuery && (
        <p className="text-sm text-(--text-muted)">
          검색 결과: <span className="font-semibold text-(--text-primary)">{filtered.length}</span>개
          {filtered.length !== associations.length && (
            <span> / 전체 {associations.length}개</span>
          )}
        </p>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Building2 className="w-12 h-12 mx-auto text-(--text-muted)" />
          <p className="text-(--text-muted)">
            {searchQuery ? '검색 결과가 없습니다.' : '등록된 협회가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-(--text-primary)">
                    {a.name}
                  </h2>
                  {(a.region || a.district) && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-(--text-muted)" />
                      <span className="text-sm text-(--text-secondary)">
                        {[a.region, a.district].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                  {a.description && (
                    <p className="text-(--text-muted) mt-1.5 text-sm line-clamp-2">
                      {a.description}
                    </p>
                  )}
                </div>
                {!a.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                    비활성
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-(--text-muted)">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  매니저 {a.manager_count}명
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  클럽 {a.club_count}개
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={withSearchQuery(`/admin/associations/${a.id}/managers`)}
                  className="btn-primary btn-sm text-xs"
                >
                  매니저 관리
                </Link>
                <Link
                  href={withSearchQuery(`/admin/associations/${a.id}`)}
                  className="btn-warning btn-sm text-xs"
                >
                  수정
                </Link>
                <DeleteAssociationButton
                  associationId={a.id}
                  associationName={a.name}
                  className="btn-danger btn-sm text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
