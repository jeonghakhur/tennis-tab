# 카카오톡 공유 기능 완료 보고서

> **Summary**: 전 페이지 카카오톡 공유 버튼 통합 + 프로덕션 URL 버그 수정
>
> **Feature**: kakao-share
> **Duration**: 2026-03-18 ~ 2026-03-20
> **Status**: ✅ Completed (98% Match Rate)

---

## 1. 기능 개요

### 목적
- 대회·클럽·커뮤니티 콘텐츠를 카카오톡으로 1-tap 공유
- 공유된 링크가 정확한 상세 페이지로 이동하도록 보장

### 적용 범위

| 페이지 | 우선순위 | 공유 URL |
|--------|---------|---------|
| 대회 상세 `/tournaments/[id]` | P1 | `/tournaments/{id}` |
| 커뮤니티 목록/상세 `/community` | P1 | `/community/{id}` |
| 클럽 모임 상세 `/clubs/[id]/sessions/[id]` | P1 | `/clubs/{clubId}/sessions/{sessionId}` |
| 클럽 소개 `/clubs/[id]` | P2 | `/clubs/{id}` |

---

## 2. PDCA 사이클 성과

### Plan Phase
- 공유 대상 4개 페이지 및 우선순위 확정
- 카카오 JS SDK `Kakao.Share.sendDefault` 피드형 메시지 방식 선정
- SDK 미로딩 시 URL 복사 fallback 요구사항 정의

### Design Phase
- 커뮤니티 전용 `KakaoShareButton` → `src/components/common/` 범용 컴포넌트로 설계
- `pageUrl` prop을 호출부에서 준비하는 인터페이스로 단순화 (HTML strip, URL 빌드 책임 이동)
- Server Component에서 `'use client'` 아일랜드 직접 삽입 패턴 확정

### Do Phase (구현)

**신규/변경 파일:**

| 파일 | 변경 | 내용 |
|------|-----|------|
| `src/components/common/KakaoShareButton.tsx` | 신규 | 범용 공유 버튼 (title/description/pageUrl props) |
| `src/components/community/KakaoShareButton.tsx` | **삭제** | 공통 컴포넌트로 대체 |
| `src/lib/kakao/share.ts` | 수정 | `absoluteUrl` 계산 상단 이동 (모든 경로 일관 적용) |
| `src/app/tournaments/[id]/page.tsx` | 수정 | 공유 버튼 삽입, relative path 전달 |
| `src/components/community/FeedCard.tsx` | 수정 | import 경로 변경, relative path 전달 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 수정 | import 경로 변경, relative path 전달 |
| `src/app/clubs/[id]/sessions/[sessionId]/page.tsx` | 수정 | 공유 버튼 삽입, 참여인원 포함 description |
| `src/app/clubs/[id]/_components/ClubDetailClient.tsx` | 수정 | 공유 버튼 삽입 |

### Check Phase (Gap 분석)

**초기 Match Rate: 93%** — 기능 요구사항 8/8 충족, Minor gap 2건 발견

| Gap | 내용 | 처리 |
|-----|-----|------|
| session description 참여인원 누락 | `_attending_count` 미포함 | ✅ 수정 |
| session title null 처리 | 타입 확인 결과 `string` (non-nullable) | 불필요 — 기각 |

**최종 Match Rate: 98%**

---

## 3. 핵심 버그 수정 (프로덕션 이슈)

### 문제
프로덕션에서 카카오 공유 클릭 시 `https://mapo-tennis.com/`(루트)로만 공유되어 상세 페이지 이동 불가.
로컬에서는 정상 동작.

### 근본 원인
`share.ts`에서 `absoluteUrl` 변환 로직이 Kakao SDK 호출 직전에만 위치했음. SDK 초기화 실패 등 이른 리턴(clipboard fallback) 경로에서는 `params.pageUrl`(상대경로)을 그대로 복사 → Kakao가 상대경로를 도메인 루트로 해석.

또한 `pageUrl` 생성 시 `NEXT_PUBLIC_SITE_URL` 서버 환경변수 의존 → Vercel 미설정 시 상대경로가 내려오는 상황에서 일관되지 않은 처리.

### 수정 내용

**`share.ts`**: `absoluteUrl` 계산을 함수 최상단으로 이동
```ts
// Before: Kakao SDK 직전에만 변환
// After: 함수 진입 시 즉시 변환 → 모든 fallback 경로에서 절대 URL 사용
const absoluteUrl = params.pageUrl.startsWith('http')
  ? params.pageUrl
  : `${window.location.origin}${params.pageUrl}`
```

**호출부 전체**: `NEXT_PUBLIC_SITE_URL` 의존 제거 → 상대경로로 통일
```tsx
// Before
pageUrl={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/tournaments/${tournament.id}`}

// After
pageUrl={`/tournaments/${tournament.id}`}
```

### 효과
- 환경변수 설정 여부와 무관하게 클라이언트 `window.location.origin`으로 항상 정확한 절대 URL 생성
- clipboard fallback도 절대 URL 복사 (이전에는 상대경로 복사)

---

## 4. 요구사항 충족 현황

| ID | 요구사항 | 결과 |
|----|---------|------|
| FR-01 | 대회 상세 카카오 공유 | ✅ |
| FR-02 | 커뮤니티 포스트 카카오 공유 | ✅ |
| FR-03 | 피드형 공유 창 오픈 | ✅ |
| FR-04 | SDK 미로딩 시 링크 복사 fallback | ✅ (개선: 절대 URL 복사) |
| FR-05 | 비회원도 공유 가능 | ✅ |
| FR-06 | 모바일/PC 동작 | ✅ |
| FR-07 | 클럽 모임 상세 공유 | ✅ |
| FR-08 | 클럽 소개 공유 (P2) | ✅ |

---

## 5. 설계 대비 개선 사항

| 항목 | 설계 | 구현 | 평가 |
|------|-----|-----|------|
| `pageUrl` 계산 | `${NEXT_PUBLIC_SITE_URL \|\| ''}/path` | 상대경로 + 클라이언트 변환 | 더 robust |
| `share.ts` | "변경 없음" | `absoluteUrl` 상단 이동 | clipboard fallback 개선 |
| SDK 로딩 | `next/script afterInteractive` | 동적 스크립트 삽입 | 기능 동등, 제어권 향상 |

---

## 6. 카카오 플랫폼 설정 가이드

공유 기능이 정상 동작하려면 카카오 개발자 콘솔에서 Web 플랫폼 도메인을 등록해야 함.

**등록 경로**: 내 애플리케이션 → 앱 설정 → 플랫폼 → Web → 사이트 도메인

**권장 등록값** (둘 다 추가):
```
https://mapo-tennis.com
https://www.mapo-tennis.com
```

---

## 7. 환경변수

| 변수 | 용도 | 필수 |
|------|-----|-----|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 JS SDK 앱 키 | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 카카오 공유 URL 생성 | ❌ (클라이언트 `window.location.origin`으로 대체) |
