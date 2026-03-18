# Report: SEO & 소셜 메타 최적화 (seo-social-meta)

> **Status**: Completed ✅
> **Date**: 2026-03-18
> **Match Rate**: 97%
> **PDCA Phase**: [Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] ✅ → [Report] ✅

---

## 1. 요약

검색엔진 노출 향상 및 소셜 공유 미리보기 품질 개선을 위해 주요 페이지에 OG 메타데이터, JSON-LD 구조화 데이터, sitemap/robots를 구현했다. `'use client'` 페이지의 `generateMetadata` 제약을 Server/Client 분리 패턴으로 해결하여 **코드 변경 없이 SEO를 위한 서버 렌더링**과 **기존 클라이언트 로직 유지**를 동시에 달성했다.

---

## 2. 구현 결과

### 2-1. 신규 생성 파일

| 파일 | 역할 |
|------|------|
| `src/lib/meta/fetchers.ts` | `React.cache()` 래핑 메타 전용 fetcher 3종 |
| `src/lib/meta/jsonld.ts` | JSON-LD 빌더 (SportsEvent / SportsOrganization / Article) |
| `src/app/robots.ts` | robots.txt — admin/my/auth 크롤 차단 |
| `src/app/sitemap.ts` | sitemap.xml — 정적 6개 + 동적(대회/클럽/커뮤니티) |
| `src/app/clubs/[id]/_components/ClubDetailClient.tsx` | 기존 클럽 상세 클라이언트 로직 분리 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 기존 커뮤니티 상세 클라이언트 로직 분리 |
| `public/og-default.jpg` | 기본 OG 이미지 1200×630 (Playwright로 생성) |

### 2-2. 수정된 파일

| 파일 | 변경 내용 |
|------|---------|
| `src/app/layout.tsx` | `metadataBase` + title template + OG + Twitter Card 전역 기본값 |
| `src/app/tournaments/[id]/page.tsx` | `generateMetadata` + SportsEvent JSON-LD 추가 |
| `src/app/clubs/[id]/page.tsx` | Server Component 전환 + `generateMetadata` + SportsOrganization JSON-LD |
| `src/app/community/[id]/page.tsx` | Server Component 전환 + `generateMetadata` + Article JSON-LD |

### 2-3. 요구사항 달성

| ID | 요구사항 | 결과 |
|----|---------|:----:|
| FR-01 | 대회 상세: OG title/description/image | ✅ |
| FR-02 | 클럽 상세: OG title/description | ✅ |
| FR-03 | 커뮤니티: OG title/description/image | ✅ |
| FR-04 | 이미지 없을 때 og-default.jpg fallback | ✅ |
| FR-05 | 대회 상세 SportsEvent JSON-LD | ✅ |
| FR-06 | sitemap.xml 공개 대회/클럽/커뮤니티 포함 | ✅ |
| FR-07 | robots.txt admin/auth/my 크롤 차단 | ✅ |
| FR-08 | title template `{페이지} \| 마포구테니스협회` | ✅ |

---

## 3. 핵심 기술 결정

### `'use client'` 페이지의 generateMetadata 문제

**문제**: `/clubs/[id]`와 `/community/[id]`는 `'use client'`로 선언되어 `generateMetadata` export 불가.

**해결**: 설계 단계에서 파악하여 Server/Client 분리 패턴으로 선제 설계.

```
Before: page.tsx ('use client') — SEO 불가

After:
  page.tsx (Server Component)
    ├── generateMetadata() ← DB 조회 + OG 메타
    └── <XxxDetailClient clubId={id} /> ← 기존 로직 그대로
         _components/XxxDetailClient.tsx ('use client')
```

이미 `/lessons/page.tsx` → `LessonsPageClient.tsx` 패턴이 프로젝트에 존재했으므로 컨벤션에 자연스럽게 부합.

### `React.cache()` 중복 fetch 방지

`generateMetadata`와 `page` 컴포넌트 양쪽에서 같은 데이터를 조회할 경우 동일 요청 내에서 중복 DB 쿼리가 발생한다. `src/lib/meta/fetchers.ts`의 모든 fetcher를 `cache()`로 래핑하여 해결.

### OG 기본 이미지 — Playwright 자동 생성

`public/og-default.jpg`를 Playwright로 직접 생성(1200×630):
- 다크 배경 + 에메랄드 그린 액센트 — 프로젝트 테마와 일관
- 한글 타이틀 + 기능 키워드 + 브랜딩

---

## 4. Gap Analysis 결과

| 항목 | 결과 |
|------|:----:|
| **Match Rate** | **97%** |
| 설계 항목 수 | 24 |
| 완전 일치 | 18 |
| 개선 방향 변경 (Low) | 5 |
| 실용적 판단 변경 (Medium) | 1 |
| 누락 | 0 |
| 추가 구현 | 3 (Twitter Card, JSON-LD 강화) |

**주요 변경 내용** (모두 개선 방향):
- JSON-LD 빌더: conditional spread로 null 필드 제외 → 더 깔끔한 structured data
- `buildSportsOrgJsonLd`: `address` 필드명 + logo `ImageObject` 추가 → schema.org 규격 강화
- tournaments/community에 Twitter Card 추가 → SNS 공유 품질 향상

---

## 5. 검증 방법

```bash
# 로컬 서버 기동 후 확인
npm run dev

# 브라우저 소스 보기
# <meta property="og:title"> 등 확인

# sitemap / robots 직접 접근
http://localhost:3000/sitemap.xml
http://localhost:3000/robots.txt

# JSON-LD 검증
https://validator.schema.org/

# OG 이미지 확인
http://localhost:3000/og-default.jpg
```

---

## 6. 후속 작업 (Optional)

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| P2 | `og-default.jpg` 전문 디자인으로 교체 | 현재는 Playwright 생성 임시본 |
| P2 | 동적 OG 이미지 (`@vercel/og`) | 대회별 포스터 없을 때 타이틀+날짜 이미지 자동 생성 |
| P3 | 네이버 서치어드바이저 / 구글 서치콘솔 등록 | 운영 태스크 |
| P3 | `/lessons/[programId]` generateMetadata | 레슨 상세 페이지 (P2 항목) |

---

## 7. 학습 포인트

1. **Next.js App Router에서 `'use client'` 페이지 SEO**: `generateMetadata`는 Server Component에서만 export 가능. 기존 클라이언트 페이지를 리팩터할 때 `_components/` 폴더에 클라이언트 컴포넌트를 분리하는 패턴이 효과적.

2. **`React.cache()`**: 같은 요청 내 동일 함수+인수 호출을 메모이제이션. `generateMetadata`와 `page`가 동시에 실행되는 Next.js 환경에서 DB 라운드트립을 줄이는 표준 패턴.

3. **Playwright OG 이미지 생성**: HTML/CSS로 디자인 후 스크린샷 — `@vercel/og` 없이도 빠르게 고품질 OG 이미지 제작 가능.
