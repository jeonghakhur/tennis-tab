# Design: 클럽 전체 회원 통합 검색

> Plan: `docs/01-plan/features/members-search.plan.md`

---

## 1. DB 변경 없음

기존 `club_members` + `clubs` 테이블 조인으로 구현. 마이그레이션 불필요.

---

## 2. 타입 추가

### 파일: `src/lib/clubs/types.ts`

파일 하단에 추가:

```typescript
/** 전체 회원 검색 결과 — ClubMember + 소속 클럽명 */
export type MemberWithClub = ClubMember & {
  club_name: string
}
```

---

## 3. Server Action 추가

### 파일: `src/lib/clubs/actions.ts`

#### 3.1 import 추가

파일 상단 `import type { ... } from './types'` 블록에 `MemberWithClub` 추가:

```typescript
import type {
  // ... 기존
  MemberWithClub,
} from './types'
```

#### 3.2 `getAllClubMembers` 함수 신규 추가

파일 하단(export 목록 뒤)에 추가:

```typescript
/** 전체 클럽 회원 통합 조회
 * - ADMIN 이상: 전체 클럽 회원
 * - MANAGER: 자신이 OWNER/ADMIN/MATCH_DIRECTOR인 클럽의 회원만
 */
export async function getAllClubMembers(): Promise<{
  data: MemberWithClub[]
  error?: string
}> {
  const { error: authError, user } = await checkManagerAuth()
  if (authError || !user) return { data: [], error: authError ?? '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const isSystemAdmin = hasMinimumRole(user.role, 'ADMIN')

  let clubIds: string[] | null = null

  // MANAGER: 관리 클럽 ID 목록 추출
  if (!isSystemAdmin) {
    const { data: memberships } = await admin
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'])
      .eq('status', 'ACTIVE')

    clubIds = memberships?.map((m) => m.club_id) ?? []
    if (clubIds.length === 0) return { data: [] }
  }

  // club_members + clubs 조인 조회
  let query = admin
    .from('club_members')
    .select(`
      *,
      clubs:club_id ( name )
    `)
    .not('status', 'in', '("REMOVED","LEFT")')
    .order('club_id')
    .order('name')

  if (clubIds !== null) {
    query = query.in('club_id', clubIds)
  }

  const { data, error } = await query

  if (error) return { data: [], error: '회원 목록 조회에 실패했습니다.' }

  const members: MemberWithClub[] = (data ?? []).map((row) => ({
    ...(row as unknown as ClubMember),
    club_name: (row.clubs as { name: string } | null)?.name ?? '알 수 없는 클럽',
  }))

  return { data: members }
}
```

---

## 4. 신규 페이지

### 파일: `src/app/admin/clubs/members/page.tsx` (신규)

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getAllClubMembers } from '@/lib/clubs/actions'
import { AllMembersSearch } from '@/components/clubs/AllMembersSearch'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function AllMembersPage({ searchParams }: Props) {
  const { q } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinimumRole(profile?.role, 'MANAGER')) redirect('/admin')

  const { data: members } = await getAllClubMembers()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clubs"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            전체 회원 검색
          </h1>
          <p className="text-(--text-secondary) mt-1">
            총 {members.length}명
          </p>
        </div>
      </div>

      <AllMembersSearch initialMembers={members} initialQuery={q ?? ''} />
    </div>
  )
}
```

---

## 5. 신규 컴포넌트

### 파일: `src/components/clubs/AllMembersSearch.tsx` (신규)

```typescript
'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { matchesKoreanSearch } from '@/lib/utils/korean'
import { Badge } from '@/components/common/Badge'
import type { MemberWithClub, ClubMemberRole, GenderType } from '@/lib/clubs/types'

const ROLE_BADGE: Record<ClubMemberRole, { label: string; variant: 'warning' | 'info' | 'purple' | 'orange' | 'success' | 'secondary' }> = {
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

  // 클라이언트 사이드 필터 — 이름(초성 포함) + 전화번호
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
                {/* 이름 + 역할 */}
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
                <p className="text-sm text-(--accent-color) font-medium">{member.club_name}</p>
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
```

> `ChevronRight` import 추가 필요: `import { Search, ChevronRight } from 'lucide-react'`

---

## 6. 기존 파일 수정

### 파일: `src/app/admin/clubs/page.tsx`

헤더 버튼 영역에 "전체 회원 검색" 링크 추가:

```typescript
// 기존 import에 추가
import { Plus, Shield, Users } from 'lucide-react'
```

**변경 전:**
```tsx
<Link href="/admin/clubs/new" className="btn-primary btn-sm flex items-center gap-1 whitespace-nowrap">
  <Plus className="w-4 h-4" />
  클럽 생성
</Link>
```

**변경 후:**
```tsx
<div className="flex gap-2">
  <Link
    href="/admin/clubs/members"
    className="btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap"
  >
    <Users className="w-4 h-4" />
    전체 회원 검색
  </Link>
  <Link href="/admin/clubs/new" className="btn-primary btn-sm flex items-center gap-1 whitespace-nowrap">
    <Plus className="w-4 h-4" />
    클럽 생성
  </Link>
</div>
```

헤더 flex 컨테이너도 `flex gap-2` → 변경 불필요 (기존 `flex-wrap items-center justify-between gap-2` 유지).

---

## 7. 수정/신규 파일 목록 (구현 순서)

| 순서 | 파일 | 유형 | 내용 |
|------|------|------|------|
| 1 | `src/lib/clubs/types.ts` | 수정 | `MemberWithClub` 타입 추가 |
| 2 | `src/lib/clubs/actions.ts` | 수정 | `getAllClubMembers()` 추가, `MemberWithClub` import |
| 3 | `src/components/clubs/AllMembersSearch.tsx` | 신규 | 검색 UI + URL 동기화 |
| 4 | `src/app/admin/clubs/members/page.tsx` | 신규 | Server Component 페이지 |
| 5 | `src/app/admin/clubs/page.tsx` | 수정 | "전체 회원 검색" 버튼 추가, `Users` icon import |

---

## 8. 검증 체크리스트

- [ ] `MemberWithClub` 타입 추가 + `tsc --noEmit` 통과
- [ ] `getAllClubMembers()` — ADMIN: 전체 반환, MANAGER: 관리 클럽만 반환
- [ ] `/admin/clubs/members` 페이지 정상 렌더링
- [ ] 이름 한글 초성 검색 동작 (예: "ㄱㅅ" → "김상록" 매칭)
- [ ] 전화번호 부분 검색 동작 (예: "1234" → 해당 번호 포함 회원)
- [ ] 검색어 입력 300ms 후 URL `?q=` 파라미터 반영
- [ ] `/admin/clubs/members?q=홍길동` 직접 접근 시 초기 검색어 반영
- [ ] 결과 행 클릭 → `/admin/clubs/[club_id]` 이동
- [ ] `/admin/clubs` 페이지에 "전체 회원 검색" 버튼 표시
- [ ] MANAGER 계정: 다른 클럽 회원 미노출 확인
- [ ] `next build` 통과
