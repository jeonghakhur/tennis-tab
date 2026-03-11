'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getClubs } from '@/lib/clubs/actions'
import type { Club, ClubJoinType, ClubMemberRole } from '@/lib/clubs/types'
import { Search, MapPin, Building2, Check } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// 모듈 레벨 캐시: 뒤로가기 시 재조회 없이 즉시 렌더링
type ClubsListCache = { clubs: Club[]; myClubRoles: Map<string, ClubMemberRole>; search: string; cityFilter: string }
let clubsListCache: ClubsListCache | null = null

const JOIN_TYPE_LABEL: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

const JOIN_TYPE_VARIANT: Record<ClubJoinType, BadgeVariant> = {
  OPEN: 'success',
  APPROVAL: 'warning',
  INVITE_ONLY: 'secondary',
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  MATCH_DIRECTOR: '경기이사',
  VICE_PRESIDENT: '부회장',
  ADVISOR: '고문',
  MEMBER: '회원',
}

// 한국 시도 데이터
const CITY_OPTIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원도', '충청북도', '충청남도',
  '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

export default function ClubsPage() {
  const router = useRouter()

  // 캐시에서 초기값 읽기 (검색/필터 없는 기본 상태만 캐시 적용)
  const isCacheValid = clubsListCache && clubsListCache.search === '' && clubsListCache.cityFilter === ''
  const [clubs, setClubs] = useState<Club[]>(isCacheValid ? clubsListCache!.clubs : [])
  const [loading, setLoading] = useState(!isCacheValid)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  // 내 클럽 멤버십 맵 (clubId → role)
  const [myClubRoles, setMyClubRoles] = useState<Map<string, ClubMemberRole>>(
    isCacheValid ? clubsListCache!.myClubRoles : new Map()
  )

  const loadClubs = useCallback(async () => {
    // 캐시가 유효하고 검색/필터 없으면 재조회 생략
    if (clubsListCache && clubsListCache.search === search && clubsListCache.cityFilter === cityFilter) return
    setLoading(true)
    const { getClubsWithMyRoles } = await import('@/lib/clubs/actions')
    const { clubs: data, myClubRoles: roles } = await getClubsWithMyRoles({
      search: search || undefined,
      city: cityFilter || undefined,
    })
    setClubs(data)
    setMyClubRoles(roles)
    setLoading(false)
    // 기본 상태(검색/필터 없음)만 캐시 저장
    if (!search && !cityFilter) {
      clubsListCache = { clubs: data, myClubRoles: roles, search: '', cityFilter: '' }
    }
  }, [search, cityFilter])

  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  // 내 클럽 우선 + 가나다순 정렬
  const sortedClubs = useMemo(() =>
    [...clubs].sort((a, b) => {
      if (myClubRoles.size > 0) {
        const aIsMine = myClubRoles.has(a.id) ? 0 : 1
        const bIsMine = myClubRoles.has(b.id) ? 0 : 1
        if (aIsMine !== bIsMine) return aIsMine - bIsMine
      }
      return a.name.localeCompare(b.name, 'ko')
    }),
    [clubs, myClubRoles]
  )

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <>
      <div
        className=""
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-content mx-auto px-6 py-12">
          {/* 헤더 */}
          <div className="mb-8">
            <h1
              className="text-3xl font-display mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              테니스 클럽 찾기
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              가까운 테니스 클럽을 찾아 가입해보세요.
            </p>
          </div>

          {/* 검색 + 필터 */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="클럽 이름으로 검색..."
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
            <Select value={cityFilter || '__all__'} onValueChange={(v) => setCityFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="px-3 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color)">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체 지역</SelectItem>
                {CITY_OPTIONS.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 클럽 목록 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-32 rounded mb-3" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-4 w-20 rounded mb-4" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-8 w-full rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                </div>
              ))}
            </div>
          ) : clubs.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">🎾</div>
              <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                {search || cityFilter ? '검색 결과가 없습니다' : '등록된 클럽이 없습니다'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search || cityFilter ? '다른 검색어나 필터를 시도해보세요.' : '곧 새로운 클럽이 등록될 예정입니다.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedClubs.map((club) => {
                const myRole = myClubRoles.get(club.id)
                const isMine = !!myRole

                return (
                  <Link
                    key={club.id}
                    href={`/clubs/${club.id}`}
                    className={`glass-card rounded-xl p-5 hover:bg-(--bg-card-hover) transition-colors group relative ${
                      isMine ? 'ring-1 ring-(--accent-color)/40' : ''
                    }`}
                  >
                    {/* 가입 표시 */}
                    {isMine && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-(--accent-color) text-(--bg-primary)">
                        <Check className="w-3 h-3" />
                        {ROLE_LABEL[myRole] || '회원'}
                      </div>
                    )}

                    {/* 클럽 이름 */}
                    <h3
                      className="font-display text-lg mb-2 group-hover:text-(--accent-color) transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {club.name}
                    </h3>

                    {/* 지역 */}
                    {(club.city || club.district) && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {[club.city, club.district].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}

                    {/* 협회 */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {club.associations?.name || '독립 클럽'}
                      </span>
                    </div>

                    {/* 하단 정보 */}
                    <div className="flex items-center justify-end pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <Badge variant={JOIN_TYPE_VARIANT[club.join_type]}>
                        {JOIN_TYPE_LABEL[club.join_type]}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
