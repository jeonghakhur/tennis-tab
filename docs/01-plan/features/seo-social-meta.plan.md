# Plan: SEO & 소셜 메타 최적화 (seo-social-meta)

## 개요

검색엔진 노출 향상 및 카카오/X(Twitter)/iMessage 등 소셜 공유 시 링크 미리보기가 올바르게 표시되도록
주요 페이지에 메타데이터(OG 태그, Twitter Card, JSON-LD 구조화 데이터)를 적용하고
`sitemap.xml` · `robots.txt`를 구성한다.

## 배경 및 목적

- 현재 `layout.tsx`에 전역 `title` / `description`만 정적으로 설정되어 있어, 모든 페이지가 동일한 메타 정보를 가짐
- 대회·클럽·커뮤니티 링크를 카카오톡/SNS로 공유할 때 미리보기가 앱 이름만 표시되는 문제
- 구글/네이버 검색 색인에 개별 페이지 콘텐츠가 반영되지 않음
- 구조화 데이터 부재로 리치 결과(이벤트 카드 등) 노출 기회 손실

## 현황 분석

| 항목 | 현재 상태 |
|------|---------|
| 전역 Metadata | `title` + `description` 정적 설정 |
| 개별 페이지 generateMetadata | ❌ 없음 |
| Open Graph 태그 | ❌ 없음 |
| Twitter Card | ❌ 없음 |
| JSON-LD 구조화 데이터 | ❌ 없음 |
| sitemap.xml | ❌ 없음 |
| robots.txt | ❌ 없음 |
| OG 기본 이미지 | `public/img/logo_mate.jpeg` 존재 (활용 필요) |
| 카카오 JS SDK 공유 | 별도 plan(`kakao-share`) — 이 feature와 상호보완 |

## 범위 (Scope)

### In-Scope

#### 1. 전역 레이아웃 메타데이터 강화 (`layout.tsx`)
- Open Graph 기본값 (사이트명, 기본 이미지, locale=ko_KR)
- Twitter Card 기본값 (summary_large_image)
- `metadataBase` 설정 (절대 URL 생성 기반)

#### 2. 페이지별 `generateMetadata` 적용

| 페이지 | 우선순위 | 동적 데이터 |
|--------|---------|------------|
| `/tournaments/[id]` | P1 | 대회명, 날짜, 장소, 포스터 이미지 |
| `/clubs/[id]` | P1 | 클럽명, 소개, 로고 |
| `/community/[id]` | P1 | 포스트 제목, 내용 미리보기(120자) |
| `/lessons/[programId]` | P2 | 레슨명, 클럽명, 썸네일 |
| `/tournaments` | P2 | 목록 정적 메타 |
| `/clubs` | P2 | 목록 정적 메타 |
| `/` (홈) | P2 | 홈 전용 메타 (기본값과 다른 description) |

#### 3. JSON-LD 구조화 데이터

| 페이지 | Schema 타입 |
|--------|------------|
| `/tournaments/[id]` | `SportsEvent` (이벤트 날짜·장소·주최자) |
| `/clubs/[id]` | `SportsOrganization` |
| `/community/[id]` | `Article` |

#### 4. sitemap.xml
- 정적 페이지 (홈, 대회 목록, 클럽 목록, 커뮤니티 목록)
- 동적 페이지 (공개된 대회, 클럽, 커뮤니티 포스트)
- 변경 빈도 / 우선순위 설정

#### 5. robots.txt
- 크롤 허용/차단 규칙 (admin/*, my/*, auth/* 차단)

#### 6. OG 기본 이미지
- `public/og-default.jpg` 생성 (1200×630, 로고 + 서비스 슬로건)
- 개별 페이지에 이미지 없는 경우 기본 이미지 fallback

### Out-of-Scope
- 동적 OG 이미지 서버 생성 (`@vercel/og`) — 추후 검토
- 네이버 서치어드바이저 / 구글 서치콘솔 등록 절차 (운영 태스크)
- 카카오 JS SDK 실제 공유 버튼 (`kakao-share` feature에서 담당)

## 기술 스택

| 항목 | 내용 |
|------|------|
| Metadata API | Next.js 15 `generateMetadata` + `Metadata` 타입 |
| 구조화 데이터 | JSON-LD inline script (next/head 없이 `<script type="application/ld+json">`) |
| sitemap | `src/app/sitemap.ts` — Next.js 내장 sitemap 라우트 |
| robots | `src/app/robots.ts` — Next.js 내장 robots 라우트 |
| OG 이미지 | 정적 이미지 (`public/og-default.jpg`) |

## 메타데이터 구조 설계

### 전역 기본값 (layout.tsx)

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'),
  title: {
    template: '%s | 마포구테니스협회',
    default: '마포구테니스협회 | 테니스 대회의 새로운 기준',
  },
  description: '대회 생성부터 참가 신청, 클럽 관리까지. 테니스 커뮤니티를 위한 올인원 플랫폼',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '마포구테니스협회',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.jpg'],
  },
}
```

### 대회 상세 generateMetadata 예시

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tournament = await fetchTournament(params.id)
  const description = `${formatSimpleDate(tournament.start_date)} · ${tournament.location} | ${tournament.host}`
  return {
    title: tournament.title,
    description,
    openGraph: {
      title: tournament.title,
      description,
      type: 'website',
      images: tournament.poster_url
        ? [{ url: tournament.poster_url, width: 1200, height: 630 }]
        : undefined,  // 전역 기본값 상속
    },
  }
}
```

## 요구사항

### 기능 요구사항

| ID | 요구사항 |
|----|---------|
| FR-01 | 대회 상세 페이지: OG title/description/image가 대회 정보로 채워짐 |
| FR-02 | 클럽 상세 페이지: OG title/description이 클럽 정보로 채워짐 |
| FR-03 | 커뮤니티 포스트: OG title/description이 포스트 정보로 채워짐 |
| FR-04 | 이미지 없는 경우 `/og-default.jpg` fallback 적용 |
| FR-05 | 대회 상세에 SportsEvent JSON-LD 삽입 |
| FR-06 | sitemap.xml에 공개 대회/클럽/커뮤니티 포스트 포함 |
| FR-07 | robots.txt에서 admin/*, auth/*, my/* 크롤 차단 |
| FR-08 | title template 적용: `{페이지 제목} | 마포구테니스협회` |

### 비기능 요구사항

- `generateMetadata`에서 DB 조회 결과를 page 컴포넌트와 **중복 조회하지 않도록** `cache()` 활용
- 서버 에러 시 기본값 fallback (404 페이지도 적절한 메타 유지)
- `force-dynamic`으로 설정된 페이지는 `generateMetadata`도 동적 실행

## 구현 계획

### 1단계: 기반 설정
- `NEXT_PUBLIC_SITE_URL` 환경변수 추가 (`.env.local`, `.env.example`)
- `layout.tsx` 전역 metadata 강화 (metadataBase + OG + Twitter)
- `public/og-default.jpg` 이미지 준비 (1200×630)
- `src/app/robots.ts` 생성
- `src/app/sitemap.ts` 정적 페이지 기본 구성

### 2단계: 핵심 동적 페이지 (P1)
- `/tournaments/[id]` — `generateMetadata` + SportsEvent JSON-LD
- `/clubs/[id]` — `generateMetadata` + SportsOrganization JSON-LD
- `/community/[id]` — `generateMetadata` + Article JSON-LD

### 3단계: 보조 페이지 및 sitemap 완성 (P2)
- `/lessons/[programId]` — `generateMetadata`
- `/tournaments`, `/clubs`, `/` 정적 메타 개선
- `sitemap.ts` 동적 페이지 (DB 쿼리로 공개 URL 수집)

### 4단계: 공유 DB 조회 최적화
- `cache()` 래퍼로 `generateMetadata` ↔ Page 컴포넌트 간 중복 fetch 제거

## 예상 파일 변경

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/app/layout.tsx` | 수정 | metadataBase + OG + Twitter 기본값 |
| `src/app/robots.ts` | 신규 | robots.txt 라우트 |
| `src/app/sitemap.ts` | 신규 | sitemap.xml 라우트 |
| `src/app/tournaments/[id]/page.tsx` | 수정 | generateMetadata + JSON-LD |
| `src/app/clubs/[id]/page.tsx` | 수정 | generateMetadata + JSON-LD |
| `src/app/community/[id]/page.tsx` | 수정 | generateMetadata + JSON-LD |
| `src/app/lessons/[programId]/page.tsx` | 수정 | generateMetadata |
| `src/lib/meta/` | 신규 디렉토리 | 메타 헬퍼 함수 (formatMetaDescription, buildJsonLd 등) |
| `public/og-default.jpg` | 신규 | 기본 OG 이미지 |
| `.env.local` / `.env.example` | 수정 | NEXT_PUBLIC_SITE_URL |

## 성공 지표

- 카카오톡/iMessage로 대회 링크 공유 시 대회명·날짜·포스터 이미지 미리보기 표시
- 구글 서치콘솔에서 SportsEvent 리치 카드 형식으로 인식
- `https://[site]/sitemap.xml` 정상 응답
- `https://[site]/robots.txt` 정상 응답 (admin 차단 확인)
- Open Graph 디버거(Facebook/Kakao)에서 이미지·제목·설명 정상 표시

## 관련 Feature

- `kakao-share` — 카카오 JS SDK 공유 버튼 (이 feature와 상호보완: OG 메타가 공유 미리보기 품질 결정)

## 우선순위 및 공수

| 단계 | 내용 | 예상 공수 |
|------|------|---------|
| P1 | 기반 설정 (layout, robots, sitemap 기본) | 1h |
| P1 | 대회·클럽·커뮤니티 상세 generateMetadata + JSON-LD | 2h |
| P2 | 레슨 상세 + 목록 페이지 메타 | 0.5h |
| P2 | sitemap 동적 페이지 완성 + cache() 최적화 | 1h |
