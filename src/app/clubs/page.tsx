'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { getClubs, getClubMemberCount } from '@/lib/clubs/actions'
import type { Club, ClubJoinType } from '@/lib/clubs/types'
import { Search, MapPin, Users, Building2 } from 'lucide-react'

const JOIN_TYPE_LABEL: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

const JOIN_TYPE_BADGE: Record<ClubJoinType, string> = {
  OPEN: 'badge-open',
  APPROVAL: 'badge-progress',
  INVITE_ONLY: 'badge-closed',
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
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')

  const loadClubs = useCallback(async () => {
    setLoading(true)
    const result = await getClubs({
      search: search || undefined,
      city: cityFilter || undefined,
    })
    if (!result.error) {
      setClubs(result.data)
      // 회원 수 병렬 조회
      const counts: Record<string, number> = {}
      await Promise.all(
        result.data.map(async (club) => {
          counts[club.id] = await getClubMemberCount(club.id)
        })
      )
      setMemberCounts(counts)
    }
    setLoading(false)
  }, [search, cityFilter])

  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
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
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            >
              <option value="">전체 지역</option>
              {CITY_OPTIONS.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
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
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.id}`}
                  className="glass-card rounded-xl p-5 hover:bg-(--bg-card-hover) transition-colors group"
                >
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
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {memberCounts[club.id] ?? 0}명
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${JOIN_TYPE_BADGE[club.join_type]}`}>
                      {JOIN_TYPE_LABEL[club.join_type]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
