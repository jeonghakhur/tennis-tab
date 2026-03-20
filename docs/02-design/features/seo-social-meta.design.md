# Design: SEO & 소셜 메타 최적화 (seo-social-meta)

## 참조 문서
- Plan: `docs/01-plan/features/seo-social-meta.plan.md`

---

## 1. 아키텍처 결정 사항

### 핵심 제약: `'use client'` 페이지의 generateMetadata

`/clubs/[id]/page.tsx`와 `/community/[id]/page.tsx`는 현재 `'use client'`로 선언되어 있어
`generateMetadata`를 직접 export할 수 없다. Next.js App Router에서 메타데이터는 Server Component에서만 export 가능.

**해결 전략: 서버/클라이언트 분리 패턴**

```
기존:
page.tsx ('use client') ← 모든 로직 포함

변경 후:
page.tsx (Server Component)
  ├── export generateMetadata()   ← 서버에서 DB 조회
  ├── 서버 사이드 초기 데이터 fetch
  └── <XxxDetailClient initialData={...} /> ← 기존 'use client' 로직
       src/app/xxx/[id]/_components/XxxDetailClient.tsx
```

이 패턴은 이미 `/lessons/page.tsx` → `LessonsPageClient.tsx`에서 사용 중.

### cache() 활용으로 중복 fetch 방지

`generateMetadata`와 `page` 컴포넌트 모두 같은 데이터를 조회하므로, `React.cache()`로 래핑하여
동일 요청 내 중복 DB 쿼리 제거.

```ts
// src/lib/meta/fetchers.ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getTournamentForMeta = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, title, start_date, location, host, poster_url, description')
    .eq('id', id)
    .single()
  return data
})
```

---

## 2. 파일 구조

```
src/
├── app/
│   ├── layout.tsx                          # [수정] metadataBase + OG 전역 기본값
│   ├── robots.ts                           # [신규] robots.txt
│   ├── sitemap.ts                          # [신규] sitemap.xml
│   ├── tournaments/
│   │   └── [id]/
│   │       └── page.tsx                    # [수정] generateMetadata + JSON-LD 추가
│   ├── clubs/
│   │   └── [id]/
│   │       ├── page.tsx                    # [수정] Server Component로 전환 + generateMetadata
│   │       └── _components/
│   │           └── ClubDetailClient.tsx    # [신규] 기존 'use client' 로직 이동
│   └── community/
│       └── [id]/
│           ├── page.tsx                    # [수정] Server Component로 전환 + generateMetadata
│           └── _components/
│               └── CommunityPostClient.tsx # [신규] 기존 'use client' 로직 이동
├── lib/
│   └── meta/
│       ├── fetchers.ts                     # [신규] cache() 래핑 메타 전용 fetcher
│       └── jsonld.ts                       # [신규] JSON-LD 빌더 함수
public/
└── og-default.jpg                          # [신규] 기본 OG 이미지 (1200×630)
.env.local / .env.example                   # [수정] NEXT_PUBLIC_SITE_URL 추가
```

---

## 3. 전역 메타데이터 설계 (`layout.tsx`)

```ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'
  ),
  title: {
    template: '%s | 마포구테니스협회',
    default: '마포구테니스협회 | 테니스 대회의 새로운 기준',
  },
  description:
    '대회 생성부터 참가 신청, 클럽 관리까지. 테니스 커뮤니티를 위한 올인원 플랫폼',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '마포구테니스협회',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: '마포구테니스협회',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.jpg'],
  },
}
```

---

## 4. 페이지별 generateMetadata 설계

### 4-1. 대회 상세 `/tournaments/[id]`

이미 Server Component이므로 최소 변경.

```ts
// src/lib/meta/fetchers.ts
export const getTournamentForMeta = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, title, start_date, end_date, location, host, poster_url, description, organizer_name')
    .eq('id', id)
    .single()
  return data
})

// src/app/tournaments/[id]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const t = await getTournamentForMeta(id)
  if (!t) return {}

  const dateStr = t.start_date
    ? new Date(t.start_date).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''
  const description = [dateStr, t.location, t.host].filter(Boolean).join(' · ')

  return {
    title: t.title,
    description,
    openGraph: {
      title: t.title,
      description,
      ...(t.poster_url && {
        images: [{ url: t.poster_url, width: 1200, height: 630, alt: t.title }],
      }),
    },
  }
}
```

**JSON-LD (SportsEvent)**:

```ts
// src/lib/meta/jsonld.ts
export function buildSportsEventJsonLd(t: TournamentMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: t.title,
    startDate: t.start_date,
    endDate: t.end_date ?? t.start_date,
    location: {
      '@type': 'Place',
      name: t.location,
    },
    organizer: {
      '@type': 'Organization',
      name: t.host,
    },
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/tournaments/${t.id}`,
    sport: '테니스',
  }
}
```

페이지 JSX에 삽입:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(buildSportsEventJsonLd(tournament)),
  }}
/>
```

### 4-2. 클럽 상세 `/clubs/[id]`

**기존 문제**: `'use client'` — 전체를 클라이언트에서 동작하며 auth 상태를 useAuth()로 가져옴.

**변경 방향**:
- `page.tsx`를 Server Component로 전환
- 초기 클럽 데이터를 서버에서 fetch → `ClubDetailClient`에 props로 전달
- `useAuth()`는 클라이언트에서 그대로 유지 (auth 상태는 서버에서 미리 가져올 필요 없음)

```ts
// src/lib/meta/fetchers.ts
export const getClubForMeta = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, location')
    .eq('id', id)
    .single()
  return data
})

// src/app/clubs/[id]/page.tsx (Server Component)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const club = await getClubForMeta(id)
  if (!club) return {}

  return {
    title: club.name,
    description: club.description?.slice(0, 160) ?? `${club.name} — 마포구테니스협회 클럽`,
    openGraph: {
      title: club.name,
      description: club.description?.slice(0, 160),
      ...(club.logo_url && {
        images: [{ url: club.logo_url, width: 1200, height: 630, alt: club.name }],
      }),
    },
  }
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params
  // generateMetadata와 같은 cache() 인스턴스를 재사용 → DB 추가 조회 없음
  const initialClub = await getClubForMeta(id)
  return <ClubDetailClient clubId={id} initialClub={initialClub} />
}
```

`ClubDetailClient.tsx`:
- 기존 `page.tsx`의 모든 state/effect 로직 그대로 이동
- `initialClub` prop을 초기 상태로 사용 (첫 렌더에 스켈레톤 없이 즉시 표시)
- 모듈 레벨 `clubCache` / `membershipCache`는 클라이언트에 그대로 유지

### 4-3. 커뮤니티 포스트 `/community/[id]`

클럽 상세와 동일한 패턴 적용.

```ts
// src/lib/meta/fetchers.ts
export const getCommunityPostForMeta = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts')
    .select('id, title, content, images, category')
    .eq('id', id)
    .single()
  return data
})

// generateMetadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = await getCommunityPostForMeta(id)
  if (!post) return {}

  // HTML 태그 제거 후 120자 미리보기
  const plainText = (post.content ?? '').replace(/<[^>]+>/g, '').slice(0, 120)
  const ogImage = post.images?.[0]

  return {
    title: post.title,
    description: plainText || post.title,
    openGraph: {
      title: post.title,
      description: plainText,
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      }),
    },
  }
}
```

---

## 5. JSON-LD 설계 (`src/lib/meta/jsonld.ts`)

```ts
// 타입 정의
interface TournamentMeta { id: string; title: string; start_date: string | null; end_date: string | null; location: string | null; host: string | null }
interface ClubMeta { id: string; name: string; description: string | null; location: string | null }
interface PostMeta { id: string; title: string; content: string | null }

export function buildSportsEventJsonLd(t: TournamentMeta): object { ... }
export function buildSportsOrgJsonLd(c: ClubMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: c.name,
    description: c.description,
    location: c.location,
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/clubs/${c.id}`,
    sport: '테니스',
  }
}
export function buildArticleJsonLd(p: PostMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: (p.content ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/community/${p.id}`,
  }
}
```

---

## 6. sitemap.ts 설계

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,              changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/tournaments`, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/clubs`,       changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/community`,   changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/lessons`,     changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/guide`,       changeFrequency: 'monthly', priority: 0.5 },
  ]

  // 동적 페이지: 공개 대회 (DRAFT 제외)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, updated_at')
    .neq('status', 'DRAFT')
    .order('updated_at', { ascending: false })
    .limit(500)

  // 동적 페이지: 클럽
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  // 동적 페이지: 커뮤니티 포스트
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  return [
    ...staticPages,
    ...(tournaments ?? []).map((t) => ({
      url: `${BASE}/tournaments/${t.id}`,
      lastModified: t.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...(clubs ?? []).map((c) => ({
      url: `${BASE}/clubs/${c.id}`,
      lastModified: c.updated_at,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(posts ?? []).map((p) => ({
      url: `${BASE}/community/${p.id}`,
      lastModified: p.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
```

---

## 7. robots.ts 설계

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/my/',
          '/auth/',
          '/api/',
          '/tournaments/*/payment/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
```

---

## 8. 구현 순서 (Do Phase 체크리스트)

### Step 1: 기반 설정
- [ ] `.env.local` / `.env.example`에 `NEXT_PUBLIC_SITE_URL` 추가
- [ ] `public/og-default.jpg` 배치 (1200×630)
- [ ] `layout.tsx` 전역 metadata 수정 (metadataBase + OG + Twitter)
- [ ] `src/app/robots.ts` 생성
- [ ] `src/app/sitemap.ts` 생성 (정적 페이지만 먼저)
- [ ] `src/lib/meta/fetchers.ts` 생성 (cache 래퍼)
- [ ] `src/lib/meta/jsonld.ts` 생성

### Step 2: 대회 상세 (Server Component — 최소 변경)
- [ ] `getTournamentForMeta` fetcher 추가
- [ ] `generateMetadata` export 추가
- [ ] `buildSportsEventJsonLd` JSON-LD 스크립트 JSX에 삽입

### Step 3: 클럽 상세 리팩터
- [ ] `getClubForMeta` fetcher 추가
- [ ] `src/app/clubs/[id]/_components/ClubDetailClient.tsx` 생성 (기존 로직 이동)
- [ ] `page.tsx` Server Component로 전환 + `generateMetadata` + JSON-LD

### Step 4: 커뮤니티 포스트 리팩터
- [ ] `getCommunityPostForMeta` fetcher 추가
- [ ] `src/app/community/[id]/_components/CommunityPostClient.tsx` 생성
- [ ] `page.tsx` Server Component로 전환 + `generateMetadata` + JSON-LD

### Step 5: sitemap 동적 페이지 완성
- [ ] `sitemap.ts`에 tournaments / clubs / posts 동적 URL 추가

---

## 9. 검증 방법

| 검증 항목 | 방법 |
|----------|------|
| OG 태그 확인 | 브라우저 소스 보기 → `<meta property="og:*">` 확인 |
| Twitter Card | `https://cards-dev.twitter.com/validator` |
| JSON-LD | `https://validator.schema.org/` |
| sitemap | `http://localhost:3000/sitemap.xml` |
| robots | `http://localhost:3000/robots.txt` |
| 카카오 링크 미리보기 | 카카오 개발자 → 디버거 도구 |

---

## 10. 주의사항

- `sitemap.ts`에서 `createAdminClient()` 사용 이유: RLS 우회로 삭제/비공개 항목 제외한 전체 목록 안전하게 조회
- `ClubDetailClient`의 `initialClub` prop: 서버에서 가져온 경량 데이터 (메타 전용 필드만). 클라이언트에서 전체 데이터를 추가 fetch할 수 있으므로 타입은 Partial로 허용
- `community/[id]` HTML 태그 제거 시 `replace(/<[^>]+>/g, '')` — XSS 목적이 아니라 메타 description 정제 용도이므로 충분
- `force-dynamic`이 설정된 페이지는 `generateMetadata`도 매 요청마다 실행됨 (캐싱 없음) → 대회 상세 페이지의 `export const dynamic = "force-dynamic"` 유지
