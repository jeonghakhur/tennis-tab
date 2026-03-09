# Plan: 홈 피드 + 플로팅 챗봇

> **작성일**: 2026-03-09
> **상태**: Plan
> **관련 파일**: `src/app/page.tsx`, `src/components/chat/ChatSection.tsx`

---

## 1. 개요

### 배경

현재 메인 페이지(`/`)는 ChatSection이 전체 화면을 차지하는 구조로, 처음 방문한 사용자에게
서비스의 핵심 콘텐츠(마감 임박 대회, 클럽 일정, 커뮤니티 포스트)를 즉시 보여주지 못한다.

챗봇은 여전히 Tennis Tab의 핵심 UI이지만, **피드 + 플로팅 챗봇** 구조로 전환하여
"방문하면 볼 거리가 있는" 홈 페이지로 개선한다.

### 목표

- 메인 페이지에서 대회, 클럽 일정, 커뮤니티 포스트를 즉시 확인 가능
- 챗봇은 플로팅 버튼으로 언제든 접근 가능 (UX 단절 없음)
- 비로그인 사용자에게도 유용한 정보 제공 (마감 임박 대회, 커뮤니티 포스트)

---

## 2. 요구사항

### 2.1 홈 피드 섹션 구성

| 섹션 | 표시 조건 | 데이터 소스 |
|------|-----------|-------------|
| 공지 배너 | 핀 고정된 공지 포스트 존재 시 | `posts` (카테고리: NOTICE, pinned) |
| 마감 임박 대회 | `entry_end_date` ≤ 7일 이내, `status = OPEN` | `tournaments` |
| 내 클럽 모임 일정 | 로그인 시, 내가 속한 클럽의 upcoming sessions | `club_sessions` + `club_members` |
| 진행 중인 대회 결과 | `status = IN_PROGRESS` 대회 | `tournaments` + `bracket_matches` |
| 커뮤니티 포스트 피드 | 항상 표시 | `posts` (기존 `getPostsFeed` 재사용) |

### 2.2 플로팅 챗봇 버튼

- 위치: 화면 오른쪽 하단 고정 (`position: fixed, bottom-6, right-6`)
- 아이콘: 말풍선 SVG (현재 ChatSection 헤더 아이콘 재사용)
- 클릭 시: **전체화면 오버레이**로 기존 ChatSection 표시
  - 상단에 닫기(X) 버튼 추가
  - ESC 키로 닫기
  - URL은 변경하지 않음 (상태 기반)
- 접근성: `aria-label="AI 어시스턴트 열기"`, `role="button"`

### 2.3 비로그인 처리

| 섹션 | 비로그인 |
|------|----------|
| 공지 배너 | 그대로 표시 |
| 마감 임박 대회 | 그대로 표시 (참가 신청 클릭 시 로그인 유도) |
| 내 클럽 모임 일정 | 섹션 숨김 |
| 진행 중인 대회 결과 | 그대로 표시 |
| 커뮤니티 포스트 | 그대로 표시 |
| 챗봇 플로팅 버튼 | 표시하되, 클릭 시 로그인 유도 배너 |

---

## 3. 아키텍처

### 3.1 페이지 구조 변경

```
현재: src/app/page.tsx → <ChatSection />
변경: src/app/page.tsx → <HomeFeed /> + <FloatingChat />
```

### 3.2 신규 컴포넌트

```
src/components/home/
├── HomeFeed.tsx              # 메인 피드 컨테이너 (Server Component)
├── NoticeBanner.tsx          # 공지 배너 (핀 고정 포스트)
├── UpcomingDeadlines.tsx     # 마감 임박 대회 카드 목록
├── ClubScheduleSection.tsx   # 내 클럽 모임 일정 (로그인 전용)
├── LiveResultsSection.tsx    # 진행 중인 대회 결과
└── RecentPostsFeed.tsx       # 최근 커뮤니티 포스트 (기존 FeedCard 재사용)

src/components/chat/
└── FloatingChat.tsx          # 플로팅 버튼 + 오버레이 래퍼 (Client Component)
```

### 3.3 데이터 페칭 전략

- `HomeFeed.tsx`: Server Component — 병렬 `Promise.all`로 초기 데이터 페칭
- 클럽 일정: `user` 서버 세션으로 userId 추출 후 조회
- 커뮤니티 포스트: 기존 `getPostsFeed` Server Action 재사용
- `FloatingChat.tsx`: Client Component — 기존 ChatSection 그대로 내포

### 3.4 신규 Server Actions

| 함수 | 위치 | 설명 |
|------|------|------|
| `getUpcomingDeadlineTournaments` | `src/lib/home/actions.ts` | 마감 7일 이내 OPEN 대회 (최대 6개) |
| `getMyClubUpcomingSessions` | `src/lib/home/actions.ts` | 내 클럽 upcoming sessions (7일 이내, 최대 5개) |
| `getLiveResults` | `src/lib/home/actions.ts` | IN_PROGRESS 대회 + 최근 경기 결과 |
| `getPinnedNotices` | `src/lib/home/actions.ts` | 핀 고정 공지 포스트 (최대 3개) |

---

## 4. UX 흐름

### 4.1 방문 흐름 (비로그인)

```
메인 진입
  → 공지 배너 (있는 경우)
  → 마감 임박 대회 카드들
  → 진행 중인 대회 결과
  → 커뮤니티 포스트 피드
  → 오른쪽 하단: 💬 플로팅 버튼 (클릭 시 "로그인이 필요합니다" 배너)
```

### 4.2 방문 흐름 (로그인)

```
메인 진입
  → 공지 배너 (있는 경우)
  → 마감 임박 대회 카드들
  → 내 클럽 모임 일정 (내가 속한 클럽 세션)
  → 진행 중인 대회 결과
  → 커뮤니티 포스트 피드
  → 오른쪽 하단: 💬 플로팅 버튼 → 클릭 시 챗봇 전체화면 오버레이
```

### 4.3 챗봇 오버레이

```
플로팅 버튼 클릭
  → 전체화면 오버레이 슬라이드 인 (bottom → center 또는 fade-in)
  → 기존 ChatSection 그대로 렌더링
  → X 버튼 또는 ESC → 오버레이 닫기 (피드 유지)
```

---

## 5. 스코프 경계

### In Scope

- 홈 피드 레이아웃 구조 신설
- 플로팅 챗봇 버튼 + 오버레이
- 마감 임박 대회 / 클럽 일정 / 진행 중 대회 결과 / 커뮤니티 포스트 피드
- 공지 배너 (핀된 포스트 활용)

### Out of Scope (향후 고려)

- 공지 배너용 별도 Admin 관리 UI (기존 커뮤니티 pinned 활용으로 대체)
- 홈 피드 개인화 (관심 지역, 관심 대회 필터링)
- 실시간 업데이트 (Realtime subscription) — 초기 릴리즈에서는 SSR 데이터만
- 홈 피드 무한 스크롤 — 커뮤니티 포스트 섹션은 "더보기 →" 링크로 처리

---

## 6. 기술 제약

- `posts` 테이블에 `pinned` 컬럼 없으면 공지 배너 섹션 스킵 또는 migration 필요
- `club_sessions` 조회는 `club_members`를 통한 userId 필터 필요 (RLS 고려)
- 홈 피드 Server Component에서 `user` 세션 조회 시 3초 타임아웃 유지 (기존 패턴)

---

## 7. 마일스톤

| 단계 | 작업 |
|------|------|
| M1 | `src/lib/home/actions.ts` 신규 Server Actions 구현 + DB 쿼리 확인 |
| M2 | `HomeFeed.tsx` + 섹션 컴포넌트들 구현 (정적 레이아웃) |
| M3 | `FloatingChat.tsx` 구현 (플로팅 버튼 + 오버레이) |
| M4 | `page.tsx` 교체 및 통합 테스트 |
| M5 | `posts.pinned` 컬럼 확인 / 없으면 migration |
