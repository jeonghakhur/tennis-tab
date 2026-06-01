'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import type { MemberWithClub, ClubMemberRole, GenderType } from '@/lib/clubs/types'
import type { BadgeVariant } from '@/components/common/Badge'

const ROLE_BADGE: Record<ClubMemberRole, { label: string; variant: BadgeVariant }> = {
  OWNER:          { label: '회장',    variant: 'warning' },
  ADMIN:          { label: '총무',    variant: 'info' },
  VICE_PRESIDENT: { label: '부회장',  variant: 'purple' },
  ADVISOR:        { label: '고문',    variant: 'orange' },
  MATCH_DIRECTOR: { label: '경기이사', variant: 'success' },
  MEMBER:         { label: '회원',    variant: 'secondary' },
}

const GENDER_LABEL: Record<GenderType, string> = { MALE: '남성', FEMALE: '여성' }

interface Props {
  members: MemberWithClub[]
  total: number
  page: number
  pageSize: number
  initialQuery?: string
}

export function AllMembersSearch({ members, total, page, pageSize, initialQuery = '' }: Props) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const totalPages = Math.ceil(total / pageSize)

  // 검색어 변경 → page=1로 리셋하여 URL 업데이트 (서버 re-render)
  const handleQueryChange = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
      // 검색 변경 시 첫 페이지로
      const qs = params.toString()
      router.replace(`/admin/clubs/members${qs ? `?${qs}` : ''}`)
    }, 300)
  }, [router])

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    if (initialQuery.trim()) params.set('q', initialQuery.trim())
    params.set('page', String(p))
    return `/admin/clubs/members?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
        <input
          type="text"
          defaultValue={initialQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="이름 또는 연락처로 검색"
          aria-label="회원 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
        />
      </div>

      {/* 결과 수 + 페이지 위치 */}
      <div className="flex items-center justify-between text-sm text-(--text-muted)">
        <span>
          {initialQuery.trim()
            ? `검색 결과 ${total.toLocaleString('ko-KR')}명`
            : `총 ${total.toLocaleString('ko-KR')}명`}
          {totalPages > 1 && ` · ${page} / ${totalPages} 페이지`}
        </span>
        <span>{pageSize}명씩 표시</span>
      </div>

      {/* 결과 목록 */}
      {members.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-(--text-muted)">
            {initialQuery.trim() ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-lg divide-y divide-(--border-color)">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/admin/clubs/${member.club_id}`}
              className="flex items-start justify-between px-4 py-3 hover:bg-(--bg-card-hover) transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-(--text-primary)">{member.name}</span>
                  <Badge variant={ROLE_BADGE[member.role].variant}>
                    {ROLE_BADGE[member.role].label}
                  </Badge>
                  <span className={`text-xs ${member.is_registered ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                    {member.is_registered ? '가입회원' : '비가입회원'}
                  </span>
                </div>
                <p className="text-sm font-medium text-(--accent-color)">{member.club_name}</p>
                <div className="flex items-center gap-2 text-sm text-(--text-muted) flex-wrap">
                  {member.phone && <span>{member.phone}</span>}
                  {member.gender && <span>{GENDER_LABEL[member.gender as GenderType]}</span>}
                  {member.birth_year && <span>{member.birth_year}</span>}
                  {member.rating && <span>레이팅 {member.rating}</span>}
                  <span>
                    가입 {(member.joined_at ?? member.created_at).slice(0, 10).replace(/-/g, '.')}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-(--text-muted) shrink-0 mt-0.5 ml-2" />
            </Link>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildPageUrl(page - 1)}
            aria-label="이전 페이지"
            aria-disabled={page <= 1}
            className={`p-2 rounded-lg border border-(--border-color) transition-colors ${
              page <= 1
                ? 'pointer-events-none opacity-30'
                : 'hover:bg-(--bg-card)'
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-(--text-secondary)" />
          </Link>

          {/* 페이지 번호 — 현재 기준 앞뒤 2페이지씩 표시 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
              acc.push(p)
              return acc
            }, [])
            .map((item, i) =>
              item === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-(--text-muted)">…</span>
              ) : (
                <Link
                  key={item}
                  href={buildPageUrl(item)}
                  className={`min-w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium border transition-colors ${
                    item === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-(--border-color) text-(--text-secondary) hover:bg-(--bg-card)'
                  }`}
                >
                  {item}
                </Link>
              )
            )}

          <Link
            href={buildPageUrl(page + 1)}
            aria-label="다음 페이지"
            aria-disabled={page >= totalPages}
            className={`p-2 rounded-lg border border-(--border-color) transition-colors ${
              page >= totalPages
                ? 'pointer-events-none opacity-30'
                : 'hover:bg-(--bg-card)'
            }`}
          >
            <ChevronRightIcon className="w-4 h-4 text-(--text-secondary)" />
          </Link>
        </div>
      )}
    </div>
  )
}
