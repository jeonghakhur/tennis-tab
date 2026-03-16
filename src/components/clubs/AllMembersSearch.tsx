'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import { matchesKoreanSearch } from '@/lib/utils/korean'
import { Badge } from '@/components/common/Badge'
import type { MemberWithClub, ClubMemberRole, GenderType } from '@/lib/clubs/types'
import type { BadgeVariant } from '@/components/common/Badge'

const ROLE_BADGE: Record<ClubMemberRole, { label: string; variant: BadgeVariant }> = {
  OWNER: { label: '회장', variant: 'warning' },
  ADMIN: { label: '총무', variant: 'info' },
  VICE_PRESIDENT: { label: '부회장', variant: 'purple' },
  ADVISOR: { label: '고문', variant: 'orange' },
  MATCH_DIRECTOR: { label: '경기이사', variant: 'success' },
  MEMBER: { label: '회원', variant: 'secondary' },
}

const GENDER_LABEL: Record<GenderType, string> = { MALE: '남성', FEMALE: '여성' }

interface Props {
  initialMembers: MemberWithClub[]
  initialQuery?: string
}

export function AllMembersSearch({ initialMembers, initialQuery = '' }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 이름(초성 포함) + 전화번호 클라이언트 사이드 필터
  const filtered = query.trim()
    ? initialMembers.filter((m) =>
        matchesKoreanSearch(m.name, query.trim()) ||
        (m.phone ?? '').includes(query.trim())
      )
    : initialMembers

  // URL ?q= 동기화 (디바운스 300ms)
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''
      router.replace(`/admin/clubs/members${params}`)
    }, 300)
  }, [router])

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="이름 또는 연락처로 검색 (초성 검색 지원)"
          aria-label="회원 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
        />
      </div>

      {/* 결과 수 */}
      <p className="text-sm text-(--text-muted)">
        {query.trim()
          ? `${initialMembers.length}명 중 ${filtered.length}명`
          : `총 ${initialMembers.length}명`}
      </p>

      {/* 결과 목록 */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-(--text-muted)">
            {query.trim() ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-lg divide-y divide-(--border-color)">
          {filtered.map((member) => (
            <Link
              key={member.id}
              href={`/admin/clubs/${member.club_id}`}
              className="flex items-start justify-between px-4 py-3 hover:bg-(--bg-card-hover) transition-colors"
            >
              <div className="space-y-1 min-w-0">
                {/* 이름 + 역할 배지 + 가입 구분 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-(--text-primary)">{member.name}</span>
                  <Badge variant={ROLE_BADGE[member.role].variant}>
                    {ROLE_BADGE[member.role].label}
                  </Badge>
                  <span className={`text-xs ${member.is_registered ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                    {member.is_registered ? '가입회원' : '비가입회원'}
                  </span>
                </div>
                {/* 소속 클럽 */}
                <p className="text-sm font-medium text-(--accent-color)">{member.club_name}</p>
                {/* 상세 정보 */}
                <div className="flex items-center gap-2 text-xs text-(--text-muted) flex-wrap">
                  {member.phone && <span>{member.phone}</span>}
                  {member.gender && <span>{GENDER_LABEL[member.gender as GenderType]}</span>}
                  {member.birth_year && <span>{member.birth_year}</span>}
                  {member.rating && <span>레이팅 {member.rating}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-(--text-muted) shrink-0 mt-0.5 ml-2" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
