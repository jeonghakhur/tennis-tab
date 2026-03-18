# Design: 카카오톡 공유 기능 (kakao-share)

> **Plan**: [kakao-share.plan.md](../../01-plan/features/kakao-share.plan.md)
> **Status**: Design
> **Date**: 2026-03-18

---

## 1. 현황 분석

### 기존 구현체

`src/components/community/KakaoShareButton.tsx` — 커뮤니티 전용, 2곳에서 사용 중

```ts
// 현재 인터페이스 (community-specific)
interface KakaoShareButtonProps {
  title: string
  content: string   // HTML → 내부에서 stripHtml() 처리
  postId: string    // URL 빌드: `/community/${postId}`
  imageUrl?: string
  compact?: boolean
  className?: string
}
```

사용처:
- `src/components/community/FeedCard.tsx` (compact=true)
- `src/app/community/[id]/_components/CommunityPostClient.tsx`

`src/lib/kakao/share.ts` — SDK 동적 로드 + `shareKakao()` 함수. **재사용 가능, 수정 불필요.**

### 신규 적용 대상 (Plan에서 확정된 우선순위)

| 우선순위 | 페이지 | URL | 컴포넌트 유형 |
|---------|--------|-----|--------------|
| P1 | 대회 상세 | `/tournaments/[id]` | Server Component |
| P1 | 클럽 모임 상세 | `/clubs/[id]/sessions/[sessionId]` | `'use client'` |
| P2 | 클럽 소개 | `/clubs/[id]` | Server Component + ClubDetailClient |
| P3 | 커뮤니티 포스트 | `/community/[id]` | 이미 구현됨 (리팩터만) |

---

## 2. 설계 결정

### 2-1. KakaoShareButton 범용화

커뮤니티 전용 로직(HTML strip, postId URL 빌드)을 컴포넌트 밖으로 꺼내고,
`src/components/common/` 아래에 범용 컴포넌트를 생성한다.

```ts
// 목표 인터페이스 (generic)
interface KakaoShareButtonProps {
  title: string
  description: string  // 이미 plain text — 호출부에서 준비
  pageUrl: string      // 호출부에서 완성된 URL 전달
  imageUrl?: string
  compact?: boolean
  className?: string
}
```

**이전 파일(`src/components/community/KakaoShareButton.tsx`)은 삭제**하고
호출부 2곳을 새 공통 컴포넌트로 직접 마이그레이션한다.
Adapter wrapper는 만들지 않는다 (호출부가 2곳뿐이고 마이그레이션 비용이 낮음).

### 2-2. Server Component에서 KakaoShareButton 사용

`'use client'` 컴포넌트는 Server Component에서 **클라이언트 아일랜드**로 임포트 가능.
string/number 등 직렬화 가능한 props만 전달하면 된다.

→ 대회 상세(`/tournaments/[id]/page.tsx`)는 Server Component를 유지한 채
`<KakaoShareButton>` 을 직접 삽입한다. 별도 래퍼 컴포넌트 불필요.

### 2-3. 모임 상세(session) 공유 내용

Session은 클럽 멤버 전용 페이지지만 **내부 공유(카카오톡으로 멤버 초대)**는 유효.
공유 URL은 `${SITE_URL}/clubs/${clubId}/sessions/${sessionId}` (인증 없이 접근 시 로그인 리다이렉트).
공유 description: `{날짜} · {장소} · {참가자수}명 참여` 포맷.

---

## 3. 구현 명세

### Step 1: 공통 KakaoShareButton 생성

**파일**: `src/components/common/KakaoShareButton.tsx` (신규)

```ts
'use client'

interface KakaoShareButtonProps {
  title: string
  description: string
  pageUrl: string
  imageUrl?: string
  compact?: boolean
  className?: string
}

export function KakaoShareButton(props: KakaoShareButtonProps) { ... }
```

내부 구현은 기존 `community/KakaoShareButton.tsx`와 동일:
- `shareKakao()` 호출
- fallback 시 Toast("링크가 복사되었습니다.")
- `compact`: 아이콘만 / 아이콘+텍스트 토글

### Step 2: 커뮤니티 호출부 마이그레이션

**파일**: `src/components/community/KakaoShareButton.tsx` → **삭제**

**`FeedCard.tsx`** 수정:
```tsx
// Before
import { KakaoShareButton } from '@/components/community/KakaoShareButton'
<KakaoShareButton title={post.title} content={post.content} imageUrl={...} postId={post.id} compact />

// After
import { KakaoShareButton } from '@/components/common/KakaoShareButton'
const description = stripHtml(post.content).slice(0, 100)
const pageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/community/${post.id}`
<KakaoShareButton title={post.title} description={description} imageUrl={...} pageUrl={pageUrl} compact />
```

`stripHtml` 유틸은 FeedCard 내부에 인라인 정의 (1줄).

**`CommunityPostClient.tsx`** 수정:
```tsx
// Before
<KakaoShareButton title={post.title} content={post.content} imageUrl={allImages[0]?.src} postId={post.id} />

// After
import { KakaoShareButton } from '@/components/common/KakaoShareButton'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
<KakaoShareButton
  title={post.title}
  description={(post.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 100)}
  imageUrl={allImages[0]?.src}
  pageUrl={`${siteUrl}/community/${post.id}`}
/>
```

### Step 3: 대회 상세 적용

**파일**: `src/app/tournaments/[id]/page.tsx` 수정

삽입 위치: 제목 영역 하단 (대회명 `<h1>` 바로 아래, 주최자 정보 옆)

```tsx
import { KakaoShareButton } from '@/components/common/KakaoShareButton'

// 공유용 데이터 (이미 서버에서 조회된 tournament 사용)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
const shareDescription = [
  tournament.start_date ? new Date(tournament.start_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
  tournament.location,
].filter(Boolean).join(' · ')

// JSX 내
<KakaoShareButton
  title={tournament.title}
  description={shareDescription}
  imageUrl={tournament.poster_url ?? undefined}
  pageUrl={`${siteUrl}/tournaments/${tournament.id}`}
/>
```

### Step 4: 클럽 모임 상세 적용

**파일**: `src/app/clubs/[id]/sessions/[sessionId]/page.tsx` 수정

현재 `'use client'` 페이지. `session` 상태 로드 후 공유 버튼 표시.

```tsx
import { KakaoShareButton } from '@/components/common/KakaoShareButton'

// session 로드 후 (session !== null 조건 내)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
const sessionDateStr = session.scheduled_at
  ? new Date(session.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  : ''
const shareDescription = [
  sessionDateStr,
  session.location,
  session.attendee_count != null ? `${session.attendee_count}명 참여` : '',
].filter(Boolean).join(' · ')

<KakaoShareButton
  title={session.title ?? `${session.club?.name ?? ''} 모임`}
  description={shareDescription}
  pageUrl={`${siteUrl}/clubs/${clubId}/sessions/${sessionId}`}
  compact
/>
```

삽입 위치: 세션 헤더 영역 (제목 + 상태 배지 행 오른쪽)

### Step 5: 클럽 소개 적용 (P2)

**파일**: `src/app/clubs/[id]/_components/ClubDetailClient.tsx` 수정

ClubDetailClient는 자체적으로 클럽 데이터를 재조회함.
클럽 데이터 로드 후 헤더 영역에 공유 버튼 삽입.

```tsx
import { KakaoShareButton } from '@/components/common/KakaoShareButton'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
<KakaoShareButton
  title={club.name}
  description={club.description?.slice(0, 100) ?? `${club.name} — 마포구테니스협회 클럽`}
  imageUrl={club.logo_url ?? undefined}
  pageUrl={`${siteUrl}/clubs/${clubId}`}
/>
```

---

## 4. 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/common/KakaoShareButton.tsx` | **신규** | 범용 공유 버튼 (description + pageUrl props) |
| `src/components/community/KakaoShareButton.tsx` | **삭제** | 공통 컴포넌트로 대체 |
| `src/components/community/FeedCard.tsx` | 수정 | import 경로 변경 + description/pageUrl 계산 인라인화 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 수정 | import 경로 변경 + description/pageUrl 계산 인라인화 |
| `src/app/tournaments/[id]/page.tsx` | 수정 | KakaoShareButton 삽입 (서버 데이터 활용) |
| `src/app/clubs/[id]/sessions/[sessionId]/page.tsx` | 수정 | KakaoShareButton 삽입 (클라이언트 state 활용) |
| `src/app/clubs/[id]/_components/ClubDetailClient.tsx` | 수정 (P2) | KakaoShareButton 삽입 |

`.env.local` / `.env.example`은 Plan에서 `NEXT_PUBLIC_KAKAO_JS_KEY`가 이미 추가된 것으로 간주.
`src/lib/kakao/share.ts`는 변경 없음.

---

## 5. 구현 순서 체크리스트

```
[ ] Step 1: src/components/common/KakaoShareButton.tsx 신규 생성
[ ] Step 2a: FeedCard.tsx — import 경로 변경 + description/pageUrl 계산
[ ] Step 2b: CommunityPostClient.tsx — import 경로 변경 + description/pageUrl 계산
[ ] Step 2c: src/components/community/KakaoShareButton.tsx 삭제
[ ] Step 3: tournaments/[id]/page.tsx — 공유 버튼 삽입
[ ] Step 4: sessions/[sessionId]/page.tsx — 공유 버튼 삽입
[ ] Step 5: ClubDetailClient.tsx — 공유 버튼 삽입 (P2)
[ ] TypeScript 빌드 확인 (npx tsc --noEmit)
```

---

## 6. 요구사항 매핑

| FR | 요구사항 | 설계 항목 |
|----|---------|----------|
| FR-01 | 대회 상세 카카오 공유 | Step 3 |
| FR-02 | 커뮤니티 포스트 카카오 공유 | Step 2 (기존 구현 리팩터) |
| FR-03 | 피드형 공유 창 오픈 | `shareKakao()` — 변경 없음 |
| FR-04 | SDK 미로딩 시 링크 복사 fallback | `shareKakao()` — 변경 없음 |
| FR-05 | 비회원도 공유 가능 | 인증 미필요 (share.ts에 auth 없음) |
| FR-06 | 모바일/PC 동작 | Kakao SDK 자체 지원 |
| FR-07 (신규) | 클럽 모임 상세 공유 | Step 4 |
| FR-08 (신규) | 클럽 소개 공유 (P2) | Step 5 |

---

## 7. 주요 설계 결정 근거

### community/KakaoShareButton → common/ 이동 (wrapper 없이)
호출부가 2곳뿐. wrapper 레이어를 두면 파일이 늘어나고 `content` vs `description` 혼용이 생긴다.
마이그레이션 비용(2파일 수정)이 wrapper 유지 비용보다 낮음.

### 대회 페이지: Server Component 유지
`generateMetadata`가 있어 Server Component여야 함. `KakaoShareButton`은 `'use client'`이지만
string props만 받으므로 Server Component에서 직접 임포트 가능 (클라이언트 아일랜드 패턴).

### 모임(session) 공유 URL — 인증 필요 페이지
공유된 URL을 비회원이 열면 로그인 페이지로 리다이렉트되는 것이 예상된 UX.
멤버 초대 목적이므로 이는 허용 범위. URL 접근 공개화는 Out-of-Scope.
