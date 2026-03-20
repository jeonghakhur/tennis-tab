# SEO & 소셜 메타 최적화 Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
> **Project**: tennis-tab
> **Analyst**: bkit-gap-detector
> **Date**: 2026-03-18
> **Design Doc**: [seo-social-meta.design.md](../02-design/features/seo-social-meta.design.md)

---

## 1. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 97% | Pass |
| Architecture Compliance | 100% | Pass |
| Convention Compliance | 100% | Pass |
| **Overall** | **97%** | **Pass** |

---

## 2. Gap Analysis (Design vs Implementation)

### Step 1: 기반 설정 (7 items)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | `.env.example` NEXT_PUBLIC_SITE_URL | ✅ Match | |
| 2 | `public/og-default.jpg` | ✅ Match | 임시 이미지 → Playwright로 교체 예정 |
| 3 | `layout.tsx` metadataBase | ✅ Match | |
| 4 | `layout.tsx` title template/default | ✅ Match | |
| 5 | `layout.tsx` OG 설정 | ⚠️ Changed (Low) | alt 텍스트가 설계보다 더 설명적 (개선) |
| 6 | `layout.tsx` Twitter Card | ✅ Match | |
| 7 | `src/app/robots.ts` | ✅ Match | 5개 disallow 경로 정확히 일치 |

### Step 2: 대회 상세 (3 items)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 8 | `getTournamentForMeta` fetcher | ✅ Match | cache() 래핑, 컬럼 일치 |
| 9 | `generateMetadata` export | ✅ Match | |
| 10 | SportsEvent JSON-LD 삽입 | ✅ Match | |

### Step 3: 클럽 상세 리팩터 (3 items)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 11 | `getClubForMeta` fetcher | ✅ Match | |
| 12 | `ClubDetailClient.tsx` 생성 | ✅ Match | 기존 로직 완전 이동 |
| 13 | `page.tsx` Server Component + generateMetadata + JSON-LD | ✅ Match | |

### Step 4: 커뮤니티 포스트 리팩터 (3 items)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 14 | `getCommunityPostForMeta` fetcher | ⚠️ Changed (Low) | `category` 미선택 (미사용 필드, 무영향) |
| 15 | `CommunityPostClient.tsx` 생성 | ✅ Match | |
| 16 | `page.tsx` Server Component + generateMetadata + JSON-LD | ✅ Match | |

### Step 5: sitemap 동적 페이지 (1 item)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 17 | sitemap.ts 동적 URL 3종 | ✅ Match | `?? undefined` null safety 추가 |

### 타입 정의 (3 items) & JSON-LD 빌더 (3 items)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 18-20 | TournamentMeta / ClubMeta / PostMeta | ✅ Match | |
| 21 | buildSportsEventJsonLd | ⚠️ Changed (Low) | conditional spread로 null 필드 제외 (개선) |
| 22 | buildSportsOrgJsonLd | ⚠️ Changed (Low) | `address` 필드명, logo ImageObject 추가 (개선) |
| 23 | buildArticleJsonLd | ⚠️ Changed (Low) | image ImageObject 조건부 추가 (SEO 강화) |

### ClubDetailClient initialClub prop (1 item)

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 24 | initialClub prop 전달 | ⚠️ Changed (Medium) | ClubMeta가 전체 Club 필드 일부에 불과 → 결국 재조회 필요. 모듈 캐시 방식이 더 실용적 |

---

## 3. 추가 구현 (설계에 없으나 개선)

| # | 항목 | 위치 | 설명 |
|---|------|------|------|
| A1 | Twitter Card (대회) | `tournaments/[id]/page.tsx` | poster_url 포함 |
| A2 | Twitter Card (커뮤니티) | `community/[id]/page.tsx` | 이미지 포함 |
| A3 | SITE_URL 모듈 상수 | `jsonld.ts:7` | process.env 중복 제거 |

---

## 4. Match Rate

| 분류 | 항목 수 | 점수 |
|------|:------:|:---:|
| Match (18개) | 18 | 18.0 |
| Changed Low (5개 × 0.95) | 5 | 4.75 |
| Changed Medium (1개 × 0.7) | 1 | 0.70 |
| Missing | 0 | 0 |
| **합계** | **24** | **23.45** |

**Match Rate: 23.45 / 24 = 97%** ✅ (기준: ≥90%)

---

## 5. 권장 조치

### Low Priority (선택)
1. `getCommunityPostForMeta` select에서 `category` 제거
2. 설계 문서에 Twitter Card, JSON-LD 개선사항 반영
3. `initialClub` prop 전달 검토 (현재 모듈 캐시 방식도 합리적)

---

## 6. 결론

누락 항목 **0건**, 97% 일치로 Check 단계 통과. `/pdca report seo-social-meta` 진행 가능.
