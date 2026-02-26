# Design: 대회 입상자 이력 (Tournament Awards)

> Plan 참조: `docs/01-plan/features/tournament-awards.plan.md`

---

## 1. DB 스키마

### 1.1 `tournament_awards` 테이블

```sql
-- supabase/migrations/15_tournament_awards.sql

CREATE TABLE public.tournament_awards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 대회 정보 (레거시: 문자열, 미래: FK 연결 가능)
  competition     TEXT NOT NULL,   -- "제37회 마포구청장기"
  year            SMALLINT NOT NULL,
  division        TEXT NOT NULL,   -- "챌린저부"
  game_type       TEXT NOT NULL CHECK (game_type IN ('단체전', '개인전')),
  award_rank      TEXT NOT NULL CHECK (award_rank IN ('우승', '준우승', '공동3위', '3위')),
  players         TEXT[] NOT NULL, -- 이름 배열 (레거시 호환, 단체전 복수 가능)
  club_name       TEXT,            -- 클럽 이름 문자열

  -- 미래 대회 연결 (레거시는 NULL)
  tournament_id   UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  division_id     UUID REFERENCES public.tournament_divisions(id) ON DELETE SET NULL,
  entry_id        UUID REFERENCES public.tournament_entries(id) ON DELETE SET NULL,

  -- 유저 클레임 (이름 확인 후 연동)
  player_user_ids UUID[],          -- 확인된 profiles.id 배열
  club_id         UUID REFERENCES public.clubs(id) ON DELETE SET NULL,

  -- 레거시 중복 방지
  legacy_id       TEXT UNIQUE,     -- Sanity _id

  -- 정렬용
  display_order   INT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거
CREATE TRIGGER update_tournament_awards_updated_at
  BEFORE UPDATE ON public.tournament_awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tournament_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament awards"
  ON public.tournament_awards FOR SELECT USING (true);

CREATE POLICY "Managers can manage tournament awards"
  ON public.tournament_awards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- 인덱스 (필터/검색 최적화)
CREATE INDEX idx_awards_year        ON public.tournament_awards (year DESC);
CREATE INDEX idx_awards_competition ON public.tournament_awards (competition);
CREATE INDEX idx_awards_players     ON public.tournament_awards USING GIN (players);
CREATE INDEX idx_awards_user_ids    ON public.tournament_awards USING GIN (player_user_ids);
CREATE INDEX idx_awards_club_id     ON public.tournament_awards (club_id);
CREATE INDEX idx_awards_tournament  ON public.tournament_awards (tournament_id);
```

### 1.2 `src/lib/supabase/types.ts` 추가

```ts
// Database.public.Tables에 추가
tournament_awards: {
  Row: {
    id: string
    competition: string
    year: number
    division: string
    game_type: string
    award_rank: string
    players: string[]
    club_name: string | null
    tournament_id: string | null
    division_id: string | null
    entry_id: string | null
    player_user_ids: string[] | null
    club_id: string | null
    legacy_id: string | null
    display_order: number
    created_at: string
    updated_at: string
  }
  Insert: Omit<tournament_awards['Row'], 'id' | 'created_at' | 'updated_at'>
  Update: Partial<tournament_awards['Insert']>
}
```

---

## 2. Import 스크립트

### `scripts/import_awards.py`

```python
"""
레거시 Sanity → Supabase tournament_awards import
실행: python3 scripts/import_awards.py

환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import json
import os
import sys
from supabase import create_client

NDJSON_PATH = '/Users/jeonghak/Downloads/mapo_tennis-export-2026-02-23t06-52-56-253z/data.ndjson'

RANK_MAP = {
    '우승': '우승',
    '준우승': '준우승',
    '3위': '3위',
    '공동3위': '공동3위',
}

def main():
    url = os.environ['SUPABASE_URL']
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    supabase = create_client(url, key)

    with open(NDJSON_PATH) as f:
        docs = [json.loads(line) for line in f]

    awards = [
        d for d in docs
        if d.get('_type') == 'award'
        and not d.get('_id', '').startswith('drafts.')
    ]
    print(f'처리 대상: {len(awards)}건')

    rows = []
    for a in awards:
        rank = RANK_MAP.get(a.get('awardCategory', ''))
        if not rank:
            print(f'  SKIP (알 수 없는 rank): {a.get("awardCategory")}')
            continue

        rows.append({
            'competition': a.get('competition', '').strip(),
            'year': int(a['year']),
            'division': a.get('division', '').strip(),
            'game_type': a.get('gameType', '개인전'),
            'award_rank': rank,
            'players': [p.strip() for p in a.get('players', [])],
            'club_name': a.get('club', '').strip() or None,
            'display_order': a.get('order', 0) or 0,
            'legacy_id': a['_id'],
        })

    # legacy_id UNIQUE → 중복 upsert 안전
    result = (
        supabase.table('tournament_awards')
        .upsert(rows, on_conflict='legacy_id')
        .execute()
    )
    print(f'import 완료: {len(result.data)}건')

if __name__ == '__main__':
    main()
```

---

## 3. 신규 파일

### 3.1 `/awards` 명예의 전당 페이지

#### `src/app/awards/page.tsx` (Server Component)

```tsx
import { createClient } from '@/lib/supabase/server'
import { AwardsFilters } from '@/components/awards/AwardsFilters'
import { AwardsList } from '@/components/awards/AwardsList'

interface SearchParams {
  year?: string
  competition?: string
  division?: string
  rank?: string
}

export const metadata = { title: '명예의 전당 | Tennis Tab' }

export default async function AwardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('tournament_awards')
    .select('*')
    .order('year', { ascending: false })
    .order('display_order', { ascending: true })

  if (params.year)        query = query.eq('year', Number(params.year))
  if (params.competition) query = query.ilike('competition', `%${params.competition}%`)
  if (params.division)    query = query.ilike('division', `%${params.division}%`)
  if (params.rank)        query = query.eq('award_rank', params.rank)

  const { data: awards } = await query.limit(200)

  // 필터 옵션용 집계
  const { data: years } = await supabase
    .from('tournament_awards')
    .select('year')
    .order('year', { ascending: false })

  const { data: competitions } = await supabase
    .from('tournament_awards')
    .select('competition')
    .order('competition')

  const uniqueYears = [...new Set(years?.map((r) => r.year) ?? [])]
  const uniqueComps = [...new Set(competitions?.map((r) => r.competition) ?? [])]

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">명예의 전당</h1>
        <p className="text-gray-500">마포구 테니스 대회 역대 입상자 기록 ({awards?.length ?? 0}건)</p>
      </div>

      <AwardsFilters
        years={uniqueYears}
        competitions={uniqueComps}
        currentParams={params}
      />

      <AwardsList awards={awards ?? []} />
    </div>
  )
}
```

#### `src/components/awards/AwardsFilters.tsx` (Client Component)

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const RANK_OPTIONS = ['우승', '준우승', '공동3위', '3위']

interface Props {
  years: number[]
  competitions: string[]
  currentParams: Record<string, string | undefined>
}

export function AwardsFilters({ years, competitions, currentParams }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/awards?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* 연도 */}
      <select
        value={currentParams.year ?? ''}
        onChange={(e) => update('year', e.target.value)}
        aria-label="연도 필터"
        className="px-3 py-2 rounded-lg border text-sm bg-(--bg-card) border-(--border-color) text-(--text-primary)"
      >
        <option value="">전체 연도</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}년</option>
        ))}
      </select>

      {/* 대회명 */}
      <select
        value={currentParams.competition ?? ''}
        onChange={(e) => update('competition', e.target.value)}
        aria-label="대회 필터"
        className="px-3 py-2 rounded-lg border text-sm bg-(--bg-card) border-(--border-color) text-(--text-primary)"
      >
        <option value="">전체 대회</option>
        {competitions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* 순위 */}
      <select
        value={currentParams.rank ?? ''}
        onChange={(e) => update('rank', e.target.value)}
        aria-label="순위 필터"
        className="px-3 py-2 rounded-lg border text-sm bg-(--bg-card) border-(--border-color) text-(--text-primary)"
      >
        <option value="">전체 순위</option>
        {RANK_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </div>
  )
}
```

#### `src/components/awards/AwardsList.tsx` (Server-safe)

```tsx
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',    // 금색 느낌
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

interface Props { awards: Award[] }

export function AwardsList({ awards }: Props) {
  if (awards.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl border border-dashed border-(--border-color)">
        <p className="text-(--text-muted)">조건에 맞는 입상 기록이 없습니다.</p>
      </div>
    )
  }

  // 연도별 그룹핑
  const grouped = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-10">
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, items]) => (
          <section key={year}>
            <h2 className="text-xl font-bold mb-4 text-(--text-primary)">{year}년</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((award) => (
                <div
                  key={award.id}
                  className="bg-(--bg-card) border border-(--border-color) rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant={RANK_BADGE[award.award_rank] ?? 'secondary'}>
                      {award.award_rank}
                    </Badge>
                    <span className="text-xs text-(--text-muted)">{award.game_type}</span>
                  </div>
                  <p className="text-sm font-medium text-(--text-secondary) truncate">
                    {award.competition}
                  </p>
                  <p className="text-xs text-(--text-muted)">{award.division}</p>
                  <div className="pt-1 border-t border-(--border-color)">
                    <p className="font-semibold text-(--text-primary)">
                      {award.players.join(', ')}
                    </p>
                    {award.club_name && (
                      <p className="text-xs text-(--text-muted)">{award.club_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
```

### 3.2 Server Action — `src/lib/awards/actions.ts`

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** 유저가 자신의 이름으로 등록된 award를 클레임 */
export async function claimAward(
  awardId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  // 현재 player_user_ids에 추가 (중복 방지)
  const admin = createAdminClient()

  const { data: award } = await admin
    .from('tournament_awards')
    .select('player_user_ids')
    .eq('id', awardId)
    .single()

  if (!award) return { success: false, error: '기록을 찾을 수 없습니다.' }

  const existing = award.player_user_ids ?? []
  if (existing.includes(user.id)) {
    return { success: false, error: '이미 연결된 기록입니다.' }
  }

  const { error } = await admin
    .from('tournament_awards')
    .update({ player_user_ids: [...existing, user.id] })
    .eq('id', awardId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/my/profile')
  return { success: true }
}
```

---

## 4. 기존 파일 수정

### 4.1 `src/app/my/profile/page.tsx` — `awards` 탭 추가

**탭 타입 확장:**
```tsx
// Before
type Tab = 'tournaments' | 'matches' | 'profile'
// After
type Tab = 'tournaments' | 'matches' | 'awards' | 'profile'
```

**탭 버튼 추가 (기존 탭 버튼 패턴 그대로):**
```tsx
<button onClick={() => setActiveTab('awards')} ...>입상 기록</button>
```

**탭 컨텐츠:**
```tsx
{activeTab === 'awards' && (
  <Suspense fallback={<div>로딩 중...</div>}>
    <ProfileAwards userId={user.id} userName={profile.full_name ?? ''} />
  </Suspense>
)}
```

**`src/components/awards/ProfileAwards.tsx` (신규 Client Component):**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { claimAward } from '@/lib/awards/actions'
import { Badge } from '@/components/common/Badge'
import { ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

export function ProfileAwards({ userId, userName }: { userId: string; userName: string }) {
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    // 1. 이미 클레임된 기록
    // 2. 이름으로 매칭되는 기록 (아직 클레임 안 된 것)
    Promise.all([
      supabase
        .from('tournament_awards')
        .select('*')
        .contains('player_user_ids', [userId])
        .order('year', { ascending: false }),
      userName
        ? supabase
            .from('tournament_awards')
            .select('*')
            .contains('players', [userName])
            .is('player_user_ids', null)  // 아직 아무도 클레임 안 한 것
            .order('year', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]).then(([claimed, unclaimedByName]) => {
      const combined = [
        ...(claimed.data ?? []).map((a) => ({ ...a, _claimed: true })),
        ...(unclaimedByName.data ?? []).map((a) => ({ ...a, _claimed: false })),
      ]
      setAwards(combined as Award[])
      setLoading(false)
    })
  }, [userId, userName])

  if (loading) return <p className="text-center py-8 text-(--text-muted)">로딩 중...</p>

  if (awards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-(--text-muted)">연결된 입상 기록이 없습니다.</p>
        <p className="text-sm text-(--text-muted) mt-1">
          이름으로 자동 검색됩니다. 기록이 있다면 확인 후 연결할 수 있습니다.
        </p>
      </div>
    )
  }

  // 통계
  const wins = awards.filter((a) => a.award_rank === '우승').length
  const runnerUps = awards.filter((a) => a.award_rank === '준우승').length
  const thirds = awards.filter((a) => a.award_rank === '공동3위' || a.award_rank === '3위').length

  return (
    <div className="space-y-6">
      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '우승', value: wins, variant: 'warning' as const },
          { label: '준우승', value: runnerUps, variant: 'secondary' as const },
          { label: '3위', value: thirds, variant: 'info' as const },
        ].map(({ label, value, variant }) => (
          <div key={label} className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-(--text-primary)">{value}</p>
            <Badge variant={variant} className="mt-1">{label}</Badge>
          </div>
        ))}
      </div>

      {/* 기록 목록 */}
      <div className="space-y-3">
        {awards.map((award) => (
          <AwardCard
            key={award.id}
            award={award}
            isClaimed={(award as Award & { _claimed?: boolean })._claimed ?? false}
            userId={userId}
          />
        ))}
      </div>
    </div>
  )
}

function AwardCard({
  award,
  isClaimed,
  userId,
}: {
  award: Award
  isClaimed: boolean
  userId: string
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  const handleClaim = async () => {
    const result = await claimAward(award.id)
    setConfirmOpen(false)
    setToast({
      isOpen: true,
      message: result.success ? '입상 기록이 연결되었습니다.' : (result.error ?? '오류가 발생했습니다.'),
      type: result.success ? 'success' : 'error',
    })
  }

  return (
    <>
      <div className="bg-(--bg-card) border border-(--border-color) rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={award.award_rank === '우승' ? 'warning' : award.award_rank === '준우승' ? 'secondary' : 'info'}>
              {award.award_rank}
            </Badge>
            <span className="text-xs text-(--text-muted)">{award.year}년</span>
          </div>
          <p className="text-sm font-medium text-(--text-primary) truncate">{award.competition}</p>
          <p className="text-xs text-(--text-muted)">{award.division} · {award.game_type}</p>
        </div>
        {!isClaimed && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-(--accent-color) text-(--bg-primary) font-medium"
          >
            내 기록
          </button>
        )}
        {isClaimed && (
          <span className="shrink-0 text-xs text-(--text-muted)">연결됨</span>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClaim}
        title="내 입상 기록으로 연결"
        message={`"${award.competition} ${award.division} ${award.award_rank}" 기록을 내 프로필에 연결합니다.`}
        type="info"
      />
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}
```

### 4.2 `src/app/clubs/[id]/page.tsx` — `awards` 탭 추가

**탭 타입 확장:**
```tsx
// Before
type Tab = 'info' | 'manage'
// After
type Tab = 'info' | 'manage' | 'awards'
```

**`src/components/awards/ClubAwards.tsx` (신규 Client Component):**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/common/Badge'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

export function ClubAwards({ clubName, clubId }: { clubName: string; clubId: string }) {
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    // club_id 연결 OR 클럽 이름 매칭 (레거시)
    supabase
      .from('tournament_awards')
      .select('*')
      .or(`club_id.eq.${clubId},club_name.ilike.${encodeURIComponent(`%${clubName}%`)}`)
      .order('year', { ascending: false })
      .then(({ data }) => {
        setAwards(data ?? [])
        setLoading(false)
      })
  }, [clubName, clubId])

  if (loading) return <p className="text-center py-8 text-(--text-muted)">로딩 중...</p>
  if (awards.length === 0) {
    return <p className="text-center py-12 text-(--text-muted)">등록된 입상 기록이 없습니다.</p>
  }

  const wins = awards.filter((a) => a.award_rank === '우승').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--text-muted)">총 {awards.length}건 · 우승 {wins}회</p>
      {awards.map((award) => (
        <div key={award.id} className="bg-(--bg-card) border border-(--border-color) rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={award.award_rank === '우승' ? 'warning' : 'secondary'}>
              {award.award_rank}
            </Badge>
            <span className="text-xs text-(--text-muted)">{award.year}년</span>
          </div>
          <p className="text-sm font-medium text-(--text-primary)">{award.competition} · {award.division}</p>
          <p className="text-xs text-(--text-muted) mt-1">{award.players.join(', ')}</p>
        </div>
      ))}
    </div>
  )
}
```

### 4.3 AI 채팅 — `VIEW_AWARDS` 신규 Intent

**`src/lib/chat/types.ts`:**
```ts
export type Intent =
  | 'SEARCH_TOURNAMENT'
  | 'VIEW_BRACKET'
  | 'VIEW_RESULTS'
  | 'VIEW_REQUIREMENTS'
  | 'VIEW_AWARDS'       // ← 추가
  | 'APPLY_TOURNAMENT'
  | 'CANCEL_ENTRY'
  | 'HELP'

export interface ChatEntities {
  // ... 기존 필드 유지 ...
  award_player_name?: string   // 추가: 입상자 검색용
  award_year?: number          // 추가: 연도 필터
}
```

**`src/lib/chat/handlers/viewAwards.ts` (신규):**

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

const RANK_EMOJI: Record<string, string> = {
  '우승': '🥇', '준우승': '🥈', '공동3위': '🥉', '3위': '🥉',
}

export async function handleViewAwards(
  entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult> {
  const admin = createAdminClient()

  let query = admin
    .from('tournament_awards')
    .select('competition, year, division, game_type, award_rank, players, club_name')
    .order('year', { ascending: false })
    .limit(10)

  // 내 입상 기록
  if (entities.scope === 'my') {
    if (!userId) {
      return {
        success: false,
        message: '내 입상 기록을 보려면 로그인이 필요합니다.',
        links: [{ label: '로그인', href: '/auth/login' }],
      }
    }
    query = query.contains('player_user_ids', [userId])
  }

  // 선수 이름 검색
  if (entities.award_player_name) {
    query = query.contains('players', [entities.award_player_name])
  }

  // 대회명 검색
  if (entities.tournament_name) {
    query = query.ilike(
      'competition',
      `%${entities.tournament_name.replace(/%/g, '\\%')}%`,
    )
  }

  // 연도 필터
  if (entities.award_year) {
    query = query.eq('year', entities.award_year)
  }

  const { data: awards } = await query

  if (!awards || awards.length === 0) {
    return {
      success: true,
      message: '조건에 맞는 입상 기록이 없습니다.',
      links: [{ label: '명예의 전당 보기', href: '/awards' }],
    }
  }

  const lines = awards.map((a) => {
    const emoji = RANK_EMOJI[a.award_rank] ?? '🏆'
    const players = a.players.join(', ')
    const club = a.club_name ? ` (${a.club_name})` : ''
    return `${emoji} ${a.year}년 ${a.competition} ${a.division} ${a.award_rank}: ${players}${club}`
  })

  return {
    success: true,
    message: `입상 기록 (${awards.length}건):\n\n${lines.join('\n')}`,
    links: [{ label: '명예의 전당 전체 보기', href: '/awards' }],
  }
}
```

**`src/lib/chat/handlers/index.ts` 수정:**
```ts
import { handleViewAwards } from './viewAwards'

const handlers: Record<Intent, IntentHandler> = {
  // ... 기존 ...
  VIEW_AWARDS: handleViewAwards,
}
```

**`src/lib/chat/prompts.ts` — 시스템 프롬프트 수정:**
```
// [지원 Intent 목록]에 추가
8. VIEW_AWARDS: 역대 입상자/수상 기록 조회
   - scope "all": "마포구청장기 우승자 알려줘", "챌린저부 역대 우승자", "입상 기록 보여줘"
   - scope "my": "내 입상 기록", "나 대회에서 수상한 적 있어?"
   - 선수 검색: "김철수 입상 기록"
```

### 4.4 `src/components/Navigation.tsx` — 명예의 전당 링크 추가

```tsx
// 기존 nav 링크 목록에 추가
<Link href="/awards">명예의 전당</Link>
```

---

## 5. 파일 변경 요약

| 파일 | 유형 | 내용 |
|------|------|------|
| `supabase/migrations/15_tournament_awards.sql` | 신규 | 테이블 + RLS + 인덱스 |
| `scripts/import_awards.py` | 신규 | 레거시 데이터 import |
| `src/app/awards/page.tsx` | 신규 | 명예의 전당 Server Component |
| `src/components/awards/AwardsFilters.tsx` | 신규 | 필터 UI (Client) |
| `src/components/awards/AwardsList.tsx` | 신규 | 목록 UI |
| `src/components/awards/ProfileAwards.tsx` | 신규 | 프로필 탭 Client Component |
| `src/components/awards/ClubAwards.tsx` | 신규 | 클럽 탭 Client Component |
| `src/lib/awards/actions.ts` | 신규 | claimAward Server Action |
| `src/lib/chat/handlers/viewAwards.ts` | 신규 | AI 채팅 핸들러 |
| `src/lib/supabase/types.ts` | 수정 | tournament_awards 타입 추가 |
| `src/lib/chat/types.ts` | 수정 | VIEW_AWARDS intent + 엔티티 추가 |
| `src/lib/chat/handlers/index.ts` | 수정 | 핸들러 매핑 추가 |
| `src/lib/chat/prompts.ts` | 수정 | VIEW_AWARDS 시스템 프롬프트 추가 |
| `src/app/my/profile/page.tsx` | 수정 | awards 탭 추가 |
| `src/app/clubs/[id]/page.tsx` | 수정 | awards 탭 추가 |
| `src/components/Navigation.tsx` | 수정 | 명예의 전당 링크 추가 |

---

## 6. 구현 순서

| # | 작업 | 파일 | 비고 |
|---|------|------|------|
| 1 | DB 마이그레이션 적용 | `15_tournament_awards.sql` | Supabase MCP |
| 2 | 타입 추가 | `types.ts` | |
| 3 | Import 스크립트 실행 | `scripts/import_awards.py` | 429건 import |
| 4 | 명예의 전당 페이지 | `awards/page.tsx` + 컴포넌트 | Server Component |
| 5 | Navigation 링크 추가 | `Navigation.tsx` | |
| 6 | 프로필 awards 탭 | `ProfileAwards.tsx` + profile page | |
| 7 | 클럽 awards 탭 | `ClubAwards.tsx` + clubs page | |
| 8 | 채팅 핸들러 | `viewAwards.ts` + types + prompts | |
| 9 | Server Action | `awards/actions.ts` | claimAward |
