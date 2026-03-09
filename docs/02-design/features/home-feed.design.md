# Design: 홈 피드 + 플로팅 챗봇

> **작성일**: 2026-03-09
> **참조 Plan**: `docs/01-plan/features/home-feed.plan.md`
> **상태**: Design

---

## 1. 컴포넌트 트리

```
src/app/page.tsx (Server Component)
├── HomeFeed (Server Component)  ← 초기 데이터 병렬 페칭
│   ├── NoticeBanner              ← is_pinned + category=NOTICE 포스트
│   ├── UpcomingDeadlinesSection  ← 마감 임박 대회 (≤7일, OPEN)
│   ├── ClubScheduleSection       ← 내 클럽 upcoming sessions (로그인 시만)
│   ├── LiveResultsSection        ← IN_PROGRESS 대회 최근 결과
│   └── RecentPostsSection        ← 커뮤니티 최신 포스트 (기존 FeedCard 재사용)
└── FloatingChat (Client Component) ← 플로팅 버튼 + 오버레이
    └── ChatSection               ← 기존 컴포넌트 그대로
```

---

## 2. 파일 구조

```
src/
├── app/
│   └── page.tsx                  # ← 수정: ChatSection 제거, HomeFeed + FloatingChat으로 교체
│
├── lib/
│   └── home/
│       └── actions.ts            # ← 신규: 홈 피드 전용 Server Actions
│
└── components/
    ├── home/
    │   ├── HomeFeed.tsx           # ← 신규 (Server Component)
    │   ├── NoticeBanner.tsx       # ← 신규 (Server Component)
    │   ├── UpcomingDeadlinesSection.tsx  # ← 신규 (Server Component)
    │   ├── DeadlineTournamentCard.tsx    # ← 신규 (Server Component, 경량 카드)
    │   ├── ClubScheduleSection.tsx       # ← 신규 (Server Component)
    │   ├── ClubSessionCard.tsx           # ← 신규 (Server Component, 경량 카드)
    │   ├── LiveResultsSection.tsx        # ← 신규 (Server Component)
    │   └── RecentPostsSection.tsx        # ← 신규 (Server Component, FeedCard 재사용)
    │
    └── chat/
        └── FloatingChat.tsx       # ← 신규 (Client Component)
```

---

## 3. Server Actions (`src/lib/home/actions.ts`)

```ts
'use server'

// 마감 임박 대회 (entry_end_date ≤ 7일, status=OPEN)
export async function getUpcomingDeadlineTournaments(): Promise<DeadlineTournament[]>

// 내 클럽 upcoming sessions (session_date ≤ 7일, status=OPEN)
export async function getMyClubUpcomingSessions(userId: string): Promise<ClubSessionWithClub[]>

// IN_PROGRESS 대회 목록 + 최근 경기 결과 (각 대회별 최대 3경기)
export async function getLiveResults(): Promise<LiveTournament[]>

// 핀 고정된 공지 포스트 (is_pinned=true, 최대 3개)
export async function getPinnedNotices(): Promise<PinnedNotice[]>
```

### 3.1 타입 정의

```ts
// 마감 임박 대회 카드용 경량 타입
export interface DeadlineTournament {
  id: string
  title: string
  location: string
  entry_end_date: string  // "YYYY-MM-DD"
  daysLeft: number        // 계산 값 (0=오늘, 1=내일, ...)
  poster_url: string | null
  division_count: number  // 부서 수
}

// 클럽 세션 + 클럽명
export interface ClubSessionWithClub extends ClubSession {
  club: { id: string; name: string }
  myAttendance: AttendanceStatus | null
}

// 진행 중 대회 + 최근 경기 결과
export interface LiveTournament {
  id: string
  title: string
  recentMatches: {
    id: string
    team1: string   // 선수명 또는 팀명
    team2: string
    score1: number | null
    score2: number | null
    winnerId: string | null
  }[]
}

// 핀 공지
export interface PinnedNotice {
  id: string
  title: string
  created_at: string
}
```

### 3.2 DB 쿼리 상세

**getUpcomingDeadlineTournaments**
```sql
SELECT t.id, t.title, t.location, t.entry_end_date, t.poster_url,
       COUNT(d.id) AS division_count
FROM tournaments t
LEFT JOIN divisions d ON d.tournament_id = t.id
WHERE t.status = 'OPEN'
  AND t.entry_end_date IS NOT NULL
  AND t.entry_end_date >= CURRENT_DATE
  AND t.entry_end_date <= CURRENT_DATE + INTERVAL '7 days'
GROUP BY t.id
ORDER BY t.entry_end_date ASC
LIMIT 6
```

**getMyClubUpcomingSessions**
```sql
-- userId로 활성 멤버 클럽 조회 후 upcoming sessions
SELECT s.*, c.id AS club_id, c.name AS club_name,
       a.status AS my_attendance
FROM club_sessions s
JOIN clubs c ON c.id = s.club_id
JOIN club_members cm ON cm.club_id = s.club_id
   AND cm.user_id = :userId
   AND cm.status = 'ACTIVE'
LEFT JOIN club_session_attendances a ON a.session_id = s.id
   AND a.club_member_id = cm.id
WHERE s.status = 'OPEN'
  AND s.session_date >= CURRENT_DATE
  AND s.session_date <= CURRENT_DATE + INTERVAL '14 days'
ORDER BY s.session_date ASC, s.start_time ASC
LIMIT 5
```

**getLiveResults**
```sql
-- IN_PROGRESS 대회 조회
SELECT id, title FROM tournaments
WHERE status = 'IN_PROGRESS'
ORDER BY start_date DESC LIMIT 5

-- 각 대회별 최근 완료된 경기 3건
SELECT m.id, m.score_home, m.score_away, m.winner_id,
       e1.player_name AS team1, e2.player_name AS team2
FROM bracket_matches m
JOIN entries e1 ON e1.id = m.home_entry_id
JOIN entries e2 ON e2.id = m.away_entry_id
WHERE m.config_id = (SELECT id FROM bracket_configs WHERE tournament_id = :tournamentId LIMIT 1)
  AND m.status = 'COMPLETED'
ORDER BY m.updated_at DESC LIMIT 3
```

**getPinnedNotices**
```sql
SELECT id, title, created_at FROM posts
WHERE is_pinned = true
  AND category = 'NOTICE'
ORDER BY created_at DESC LIMIT 3
```

---

## 4. 컴포넌트 상세 설계

### 4.1 `page.tsx` (수정)

```tsx
import { createClient } from '@/lib/supabase/server'
import { HomeFeed } from '@/components/home/HomeFeed'
import { FloatingChat } from '@/components/chat/FloatingChat'

export default async function Home() {
  const supabase = await createClient()
  const fallback = { data: { user: null } } as const
  const { data: { user } } = await Promise.race([
    supabase.auth.getUser().catch(() => fallback),
    new Promise<typeof fallback>((resolve) => setTimeout(() => resolve(fallback), 3000)),
  ])

  return (
    <>
      <HomeFeed userId={user?.id ?? null} />
      <FloatingChat isLoggedIn={!!user} />
    </>
  )
}
```

### 4.2 `HomeFeed.tsx` (Server Component)

```tsx
interface HomeFeedProps {
  userId: string | null
}

export async function HomeFeed({ userId }: HomeFeedProps) {
  // 병렬 페칭 (비로그인 시 클럽 세션 스킵)
  const [notices, deadlineTournaments, liveTournaments, recentPosts, clubSessions] =
    await Promise.all([
      getPinnedNotices(),
      getUpcomingDeadlineTournaments(),
      getLiveResults(),
      getPostsFeed({ limit: 6 }),           // 기존 함수 재사용
      userId ? getMyClubUpcomingSessions(userId) : Promise.resolve([]),
    ])

  return (
    <main className="max-w-content mx-auto px-4 py-8 space-y-10">
      <NoticeBanner notices={notices} />
      <UpcomingDeadlinesSection tournaments={deadlineTournaments} />
      {userId && clubSessions.length > 0 && (
        <ClubScheduleSection sessions={clubSessions} />
      )}
      <LiveResultsSection tournaments={liveTournaments} />
      <RecentPostsSection posts={recentPosts.data} />
    </main>
  )
}
```

### 4.3 `NoticeBanner.tsx`

- 핀 공지가 없으면 `null` 반환 (섹션 자체 숨김)
- 1개: 단일 배너
- 복수: 가로 스크롤 또는 스택

```tsx
// 레이아웃 예시
<section aria-label="공지사항">
  <div className="rounded-xl px-4 py-3 flex items-center gap-3"
       style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>공지</span>
    <Link href={`/community/${notice.id}`} className="text-sm truncate">
      {notice.title}
    </Link>
    <time className="text-xs ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>
      {formatRelativeDate(notice.created_at)}
    </time>
  </div>
</section>
```

### 4.4 `DeadlineTournamentCard.tsx` (경량 카드)

- 기존 `TournamentCard`와 별도 (홈 피드 전용 컴팩트 디자인)
- 가로 스크롤 컨테이너 내 카드 (`w-64` 고정폭)

```
┌──────────────────────┐
│ [포스터 이미지 / 플홀더] │
│ ██████████████████   │
│ D-3   마포구청장기     │  ← D-day 배지 + 대회명
│ 📍 마포구  · 3개 부서   │
│ [신청하기]             │
└──────────────────────┘
```

**D-day 배지 색상:**
- `daysLeft === 0`: `variant="danger"` (오늘 마감)
- `daysLeft <= 3`: `variant="warning"`
- `daysLeft <= 7`: `variant="info"`

### 4.5 `ClubSessionCard.tsx` (경량 카드)

```
┌──────────────────────────────┐
│ 🎾 마포 클럽    내일 (목) 10:00  │
│ 잠실 실내 테니스 코트 1, 2       │
│ [참석] [미참석] [미정]           │ ← 내 출석 상태 표시 (읽기 전용)
└──────────────────────────────┘
```

- 출석 상태 배지: `ATTENDING`→success, `NOT_ATTENDING`→danger, `UNDECIDED` / null → secondary
- 클릭 시 `/clubs/{clubId}/sessions/{sessionId}` 이동

### 4.6 `LiveResultsSection.tsx`

- IN_PROGRESS 대회가 없으면 섹션 숨김
- 대회별 최근 3경기 compact 리스트

```
┌─────────────────────────────────────┐
│ 마포구청장기 2026 진행 중            │
│  김민준  6-4  이준혁   ✓             │
│  박서연  3-6  최수아                 │
│  ...            [대진표 보기 →]      │
└─────────────────────────────────────┘
```

### 4.7 `RecentPostsSection.tsx`

- 기존 `FeedCard` 컴포넌트 재사용 (수정 없음)
- `grid-cols-1 sm:grid-cols-2` 레이아웃
- 하단 `[커뮤니티 더보기 →]` 링크 (`/community`)

### 4.8 `FloatingChat.tsx` (Client Component)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ChatSection } from './ChatSection'
import { MessageCircle, X } from 'lucide-react'

interface FloatingChatProps {
  isLoggedIn: boolean
}

export function FloatingChat({ isLoggedIn }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false)

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // 오버레이 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="AI 어시스턴트 열기"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg
                   flex items-center justify-center z-40 transition-all
                   hover:scale-110 active:scale-95"
        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
      >
        <MessageCircle className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* 전체화면 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: 'var(--bg-primary)' }}
          role="dialog"
          aria-modal="true"
          aria-label="AI 어시스턴트"
        >
          {/* 오버레이 헤더 (닫기 버튼) */}
          <div
            className="shrink-0 flex items-center justify-between px-4 h-14 border-b"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              AI 어시스턴트
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="닫기"
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* 기존 ChatSection */}
          <div className="flex-1 overflow-hidden">
            <ChatSection isLoggedIn={isLoggedIn} />
          </div>
        </div>
      )}
    </>
  )
}
```

---

## 5. 레이아웃 구조

```
┌─────────────────────────────────────┐
│ [헤더 네비]                          │
├─────────────────────────────────────┤
│ 📢 [공지] 마포구청장기 요강 안내        │  ← NoticeBanner (있을 때만)
├─────────────────────────────────────┤
│ 마감 임박 대회                        │
│ ← [D-2 마포구청장기] [D-5 한강배] →   │  ← 가로 스크롤
├─────────────────────────────────────┤
│ 내 클럽 모임 일정  (로그인 시)          │
│ 🎾 마포 클럽 · 내일 10:00             │  ← 세로 스택 (최대 3개)
├─────────────────────────────────────┤
│ 진행 중인 대회                        │
│ 마포구청장기 2026 >                   │  ← 대회별 최근 경기
├─────────────────────────────────────┤
│ 최근 커뮤니티 소식                     │
│ [FeedCard] [FeedCard]               │  ← 2열 그리드
│ [커뮤니티 더보기 →]                   │
└─────────────────────────────────────┘
                          [💬]  ← fixed bottom-right
```

---

## 6. 접근성

| 요소 | 처리 |
|------|------|
| FloatingChat 오버레이 | `role="dialog"`, `aria-modal="true"` |
| 플로팅 버튼 | `aria-label="AI 어시스턴트 열기"` |
| 오버레이 닫기 버튼 | `aria-label="닫기"` |
| 섹션 구분 | `<section aria-label="...">` 각 섹션에 적용 |
| 가로 스크롤 컨테이너 | `role="list"` + 개별 카드 `role="listitem"` |

---

## 7. 구현 순서 (Do Phase 참조)

1. `src/lib/home/actions.ts` — Server Actions 4개 구현 + DB 쿼리 검증
2. `NoticeBanner.tsx` — 가장 단순, 먼저 확인
3. `DeadlineTournamentCard.tsx` + `UpcomingDeadlinesSection.tsx`
4. `ClubSessionCard.tsx` + `ClubScheduleSection.tsx`
5. `LiveResultsSection.tsx`
6. `RecentPostsSection.tsx` — FeedCard 재사용이므로 경량 작업
7. `HomeFeed.tsx` — 섹션 조립
8. `FloatingChat.tsx` — 오버레이 구현
9. `page.tsx` 교체

---

## 8. 주의사항 및 결정 사항

### posts.is_pinned 활용

`is_pinned` 컬럼은 이미 존재하며 `getPostsFeed`에서도 사용 중.
공지 배너는 `is_pinned=true AND category='NOTICE'`로 조회 — 별도 migration 불필요.

### 마감 임박 대회 "오늘 마감" 처리

`daysLeft` 계산: 서버에서 `entry_end_date`와 현재 날짜 차이를 일 단위로 계산.
`entry_end_date`가 오늘이면 `daysLeft=0` → "오늘 마감" 배지 (danger).

### FloatingChat 상태 독립성

오버레이 닫혀도 ChatSection 내부 메시지 히스토리 보존.
`isOpen` 토글 시 컴포넌트 언마운트 방지 → CSS visibility/display 대신 `{isOpen && ...}` 사용 시 히스토리 초기화됨.

**해결**: 오버레이는 항상 렌더링하되, `hidden` 클래스로 가시성 제어.

```tsx
// ChatSection 항상 렌더링, visibility 제어
<div className={isOpen ? 'fixed inset-0 z-50 flex flex-col' : 'hidden'}>
  ...
  <ChatSection isLoggedIn={isLoggedIn} />
</div>
```

### 클럽 세션 조회 권한

`createClient()` (사용자 세션) vs `createAdminClient()`:
- `getMyClubUpcomingSessions`는 userId 매개변수로 직접 필터링 → `createAdminClient()` 사용 (기존 session-actions.ts 패턴 동일).

### 섹션 empty state

데이터가 없는 섹션은 섹션 자체를 렌더링하지 않음 (빈 컨테이너 노출 금지).
`HomeFeed.tsx`에서 배열 길이 체크 후 조건부 렌더링.
