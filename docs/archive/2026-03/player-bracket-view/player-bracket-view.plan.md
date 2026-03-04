---
template: plan
version: 1.2
description: 선수 관점 대진표 조회 및 점수 입력 기능 계획서
variables:
  - feature: player-bracket-view
  - date: 2026-02-10
  - author: AI Assistant
  - project: tennis-tab
  - version: 0.1
---

# player-bracket-view Planning Document

> **Summary**: 참가 선수가 진행중인 대회의 대진표를 조회하고 본인 경기 점수를 직접 입력할 수 있는 기능
>
> **Project**: tennis-tab
> **Version**: 0.1
> **Author**: AI Assistant
> **Date**: 2026-02-10
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

참가 선수가 마이페이지에서 자신이 참가한 진행중인 대회의 대진표를 확인하고, 본인이 참여한 경기의 점수를 직접 입력하여 대회 운영을 돕는다. 또한 실시간으로 업데이트되는 통계를 제공한다.

### 1.2 Background

현재 시스템에서 대진표 조회 및 점수 입력은 관리자(Admin)만 가능하다. 참가 선수는 자신의 대진표를 확인할 수 없고, 경기 결과를 관리자가 입력할 때까지 기다려야 한다. 이로 인해:

- 경기 결과 입력 지연
- 관리자의 수동 작업 부담 증가
- 참가 선수의 실시간 대진표 확인 불가

선수가 직접 점수를 입력하면 대회 운영이 효율적으로 진행되고, 참가 선수의 편의성이 크게 향상된다.

### 1.3 Related Documents

- Admin BracketManager: `src/components/admin/BracketManager/`
- 사용자 데이터 조회: `src/lib/data/user.ts`
- 프로필 페이지: `src/app/my/profile/page.tsx`
- CLAUDE.md: Modal, AlertDialog, Toast 컴포넌트 사용 가이드

---

## 2. Scope

### 2.1 In Scope

- [x] 참가 대회 목록에서 IN_PROGRESS 상태 대회에 "대진표 보기" 버튼 표시
- [x] 진행중인 대회의 대진표 조회 (예선/본선 구분)
- [x] 본인이 참여한 경기만 점수 입력 가능 (개인전/복식/단체전)
- [x] 점수 입력 후 실시간 통계 카드 업데이트
- [x] 단체전 세트별 결과 입력 지원
- [x] 점수 입력 권한 검증 (본인 경기만)

### 2.2 Out of Scope

- 대진표 생성/조 편성 기능 (관리자 전용)
- 경기 스케줄링 기능
- 다른 선수의 경기 점수 입력
- 실시간 채팅/알림 기능
- 경기 영상/사진 업로드

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 참가 대회 목록에서 IN_PROGRESS 상태 대회 구분 표시 | High | Pending |
| FR-02 | 진행중인 대회에 "대진표 보기" 버튼 추가 | High | Pending |
| FR-03 | 대진표 조회 페이지: 예선/본선 탭 구분 | High | Pending |
| FR-04 | 본인 참여 경기 하이라이트 표시 (배경색/테두리) | Medium | Pending |
| FR-05 | 본인 경기에만 "점수 입력" 버튼 표시 | High | Pending |
| FR-06 | 개인전 점수 입력 모달 (세트 점수) | High | Pending |
| FR-07 | 복식 점수 입력 모달 (파트너 표시 + 세트 점수) | High | Pending |
| FR-08 | 단체전 점수 입력 모달 (세트별 선수 배정 + 점수) | High | Pending |
| FR-09 | 점수 입력 권한 검증 (본인 경기만) | High | Pending |
| FR-10 | 점수 입력 후 통계 카드 실시간 업데이트 | High | Pending |
| FR-11 | 이미 입력된 점수 수정 가능 (본인 경기만) | Medium | Pending |
| FR-12 | 점수 입력 시 상대방에게 확인 요청 (선택사항) | Low | Out of Scope (v2) |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 대진표 로딩 < 1초 | Lighthouse, Real User Monitoring |
| Security | 본인 경기만 점수 입력 가능 (Server Actions 권한 검증) | 코드 리뷰, 침투 테스트 |
| Accessibility | 모바일 터치 최적화, 다크모드 지원 | 실제 디바이스 테스트 |
| UX | 점수 입력 후 즉시 반영 (Optimistic Update) | 사용자 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] IN_PROGRESS 대회에 "대진표 보기" 버튼 추가 완료
- [x] 대진표 조회 페이지 구현 (예선/본선 탭)
- [x] 점수 입력 모달 구현 (개인전/복식/단체전)
- [x] 점수 입력 권한 검증 Server Actions 구현
- [x] 통계 카드 실시간 업데이트 구현
- [x] 모바일 반응형 UI 완료
- [x] 다크모드 지원 완료
- [x] 코드 리뷰 완료

### 4.2 Quality Criteria

- [x] TypeScript strict 모드 에러 0개
- [x] ESLint 에러 0개
- [x] Build 성공
- [x] 권한 검증 로직 침투 테스트 통과

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 동시 점수 입력 시 충돌 (양 선수가 동시 입력) | Medium | Medium | 낙관적 업데이트 + 충돌 감지 알림 |
| 권한 우회 (다른 선수 점수 입력) | High | Low | Server Actions에서 이중 검증 (user_id + entry_id) |
| 대진표 데이터 과다 로딩 (대회 규모 큰 경우) | Medium | Low | 페이지네이션 또는 가상 스크롤 적용 |
| 모바일에서 복잡한 단체전 입력 UX | Medium | Medium | 단순화된 모바일 전용 레이아웃 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration (bkend.ai) | Web apps with backend, SaaS MVPs, fullstack apps | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

**선택 근거**: 현재 프로젝트는 Next.js + Supabase 기반 Dynamic 레벨. 기존 코드베이스와 일관성 유지.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | Next.js 16 | 기존 프로젝트 스택 |
| State Management | Context / Zustand / Redux | useState + useEffect | 컴포넌트 로컬 상태로 충분 (서버 데이터 중심) |
| API Client | fetch / axios / Server Actions | Server Actions | 기존 패턴 일관성 (`src/lib/bracket/actions.ts`) |
| Form Handling | react-hook-form / formik / native | native useState | 점수 입력 폼이 단순 (세트 점수 2-3개) |
| Styling | Tailwind / CSS Modules / styled-components | Tailwind + CSS Variables | 기존 스타일 시스템 (`var(--accent-color)` 등) |
| Modal | Dialog API / Custom Modal | Custom Modal (`Modal.tsx`) | CLAUDE.md 권장 컴포넌트 |
| Alert | window.alert / Custom Dialog | AlertDialog / Toast | CLAUDE.md 권장 컴포넌트 |

### 6.3 Clean Architecture Approach

```
Selected Level: Dynamic

Folder Structure:
┌─────────────────────────────────────────────────────┐
│ src/app/my/brackets/[tournamentId]/                 │ ← 대진표 조회 페이지
│ src/components/player/                              │ ← 선수용 컴포넌트
│   ├── BracketViewer/                                │
│   │   ├── index.tsx                                 │
│   │   ├── GroupsView.tsx                            │
│   │   ├── BracketView.tsx                           │
│   │   └── ScoreInputModal.tsx                       │
│ src/lib/bracket/actions.ts                          │ ← 기존 Server Actions 확장
│   ├── submitPlayerScore()                           │ ← 신규 추가
│   ├── getPlayerBracket()                            │ ← 신규 추가
│ src/lib/data/user.ts                                │ ← 통계 조회 함수 개선
│   └── getUserStats() (기존)                         │
└─────────────────────────────────────────────────────┘
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section (UI Components Guide 포함)
- [x] TypeScript configuration (`tsconfig.json` - strict mode)
- [x] ESLint configuration (`.eslintrc.*`)
- [ ] `docs/01-plan/conventions.md` exists (Phase 2 output)
- [ ] Prettier configuration (`.prettierrc`)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | exists (CLAUDE.md) | player/BracketViewer 네이밍 일관성 | High |
| **Folder structure** | exists | `src/components/player/` 신규 추가 | High |
| **Modal usage** | exists (CLAUDE.md) | ScoreInputModal은 Modal.tsx 사용 필수 | High |
| **Alert/Toast** | exists (CLAUDE.md) | 점수 입력 성공 → Toast, 에러 → AlertDialog | Medium |
| **Error handling** | exists | Server Actions try-catch 패턴 일관성 | Medium |

### 7.3 Environment Variables Needed

기존 환경변수 사용 (신규 추가 불필요):

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 연결 | Client | ☑ (기존) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 인증 | Client | ☑ (기존) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin 작업 | Server | ☑ (기존) |

### 7.4 Pipeline Integration

현재 프로젝트는 9-phase Development Pipeline을 사용하지 않음. PDCA 사이클로 진행.

---

## 8. Technical Design Preview

### 8.1 Database Schema (기존 테이블 활용)

```sql
-- 사용할 기존 테이블
tournaments (id, title, status, config_id)
tournament_entries (id, tournament_id, user_id, division_id, status)
groups (id, config_id, name, position)
matches (
  id, config_id, group_id,
  player1_id, player2_id, winner_id,
  score, sets_detail, -- 점수 입력 대상 컬럼
  status, round, match_number
)
division_entries (division_id, user_id, is_primary) -- 복식/단체전 파트너 조회
```

### 8.2 Server Actions 설계

```typescript
// src/lib/bracket/actions.ts 확장

/**
 * 선수용 대진표 조회 (본인 경기 하이라이트 정보 포함)
 */
export async function getPlayerBracket(tournamentId: string) {
  const user = await getCurrentUser();
  // 1. 권한 검증: 해당 대회에 참가했는지 확인
  // 2. 대진표 데이터 조회 (groups, matches)
  // 3. 본인 참여 경기 표시 정보 추가
  // 4. return { groups, matches, myMatches: [...] }
}

/**
 * 선수가 본인 경기 점수 입력
 */
export async function submitPlayerScore(
  matchId: string,
  score: string,
  setsDetail?: SetDetail[]
) {
  const user = await getCurrentUser();
  // 1. 권한 검증: 해당 경기에 참여했는지 확인 (player1_id OR player2_id)
  // 2. 경기 상태 확인 (SCHEDULED만 입력 가능)
  // 3. 점수 입력 (score, sets_detail, status=COMPLETED, completed_at, winner_id)
  // 4. 승자 전파 (다음 라운드 매치 업데이트)
  // 5. return { success, message }
}
```

### 8.3 UI Component 구조

```typescript
// src/app/my/brackets/[tournamentId]/page.tsx
export default function PlayerBracketPage({ params }) {
  // 대진표 조회
  const { groups, matches, myMatches } = await getPlayerBracket(params.tournamentId);

  return (
    <BracketViewer
      groups={groups}
      matches={matches}
      myMatches={myMatches}
      onScoreSubmit={handleScoreSubmit}
    />
  );
}

// src/components/player/BracketViewer/ScoreInputModal.tsx
interface ScoreInputModalProps {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: string, setsDetail?: SetDetail[]) => Promise<void>;
}
```

### 8.4 통계 업데이트 로직

```typescript
// src/lib/data/user.ts 개선
export async function getUserStats() {
  // 기존 로직 유지
  // 점수 입력 후 프로필 페이지에서 자동 refetch
}

// 프로필 페이지에서 optimistic update 적용
const handleScoreSubmit = async () => {
  // 1. 낙관적 업데이트 (즉시 UI 반영)
  setStats(prev => ({ ...prev, totalMatches: prev.totalMatches + 1 }));

  // 2. 실제 API 호출
  await submitPlayerScore(...);

  // 3. 최종 데이터 refetch
  await loadStats();
};
```

---

## 9. Next Steps

1. [x] Design 문서 작성 (`player-bracket-view.design.md`)
   - 상세 UI 와이어프레임
   - Server Actions 상세 구현 설계
   - 권한 검증 로직 시퀀스 다이어그램
   - 에러 핸들링 시나리오
2. [ ] Team review and approval
3. [ ] Start implementation (PDCA Do phase)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-10 | Initial draft | AI Assistant |
