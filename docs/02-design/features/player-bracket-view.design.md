# player-bracket-view Design Document

> **Summary**: 참가 선수가 진행중인 대회의 대진표를 조회하고 본인 경기 점수를 직접 입력 + 통계 카드 개선
>
> **Project**: tennis-tab
> **Version**: 0.1
> **Author**: AI Assistant
> **Date**: 2026-02-10
> **Status**: Draft
> **Planning Doc**: [player-bracket-view.plan.md](../01-plan/features/player-bracket-view.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **기존 컴포넌트 재사용 극대화**: 공개 대진표 뷰어(`BracketView.tsx`)를 확장하여 선수 전용 기능 추가
2. **최소 침습**: 기존 코드 변경을 최소화하고, props 추가로 기능 분기
3. **보안**: 점수 입력 권한을 Server Action에서 이중 검증 (본인 경기 + 경기 상태)
4. **통계 정확성**: bracket_matches 기반 통계 추가 (기존 matches 테이블과 병합)

### 1.2 Design Principles

- 기존 BracketView에 선택적 props 추가 → 비로그인/비참가자는 기존 읽기 전용
- 점수 입력은 기존 `updateMatchResult` 내부 로직 재사용 (공유 함수 추출)
- 단일 책임: ScoreInputModal은 점수 입력에만 집중, 승자 전파는 서버에서 처리

---

## 2. Architecture

### 2.1 Component Diagram

```
[프로필 페이지]                    [대진표 페이지]
src/app/my/profile/page.tsx        src/app/tournaments/[id]/bracket/page.tsx (Server Component)
  │                                  │
  │ "대진표 보기" 링크                │ 로그인 유저의 entry_ids 조회
  │ → /tournaments/[id]/bracket      │ → currentUserEntryIds prop 전달
  │                                  │
  └──────────────────────────────────▶ BracketView (Client Component)
                                       │
                                       ├── PreliminaryView → MatchCard (하이라이트 + 점수 입력)
                                       ├── MainBracketView → BracketMatchCard + MatchCard (하이라이트 + 점수 입력)
                                       └── ScoreInputModal (NEW) ── submitPlayerScore() Server Action
                                                                           │
                                                                           ├── 권한 검증 (본인 경기?)
                                                                           ├── 점수 저장
                                                                           ├── 승자 전파 (공유 로직)
                                                                           └── 순위 업데이트 (예선)
```

### 2.2 Data Flow

```
[프로필 페이지]
  1. loadTournaments() → IN_PROGRESS 대회 표시 + "대진표 보기" 링크

[대진표 페이지 - Server Component]
  2. getCurrentUser() → user_id 획득
  3. tournament_entries에서 user_id로 entry_ids 조회
  4. <BracketView currentUserEntryIds={entryIds} matchType={matchType} teamMatchCount={teamMatchCount} />

[BracketView - Client Component]
  5. getBracketData(divisionId) → config, groups, matches
  6. MatchCard: currentUserEntryIds로 본인 경기 하이라이트
  7. SCHEDULED 상태 본인 경기에 "점수 입력" 버튼
  8. 클릭 → ScoreInputModal 오픈
  9. 점수 입력 → submitPlayerScore(matchId, team1Score, team2Score, setsDetail?)
  10. 성공 → loadBracketData() refetch → Toast 표시

[통계 갱신 - 프로필 페이지]
  11. loadStats() → getUserStats() (bracket_matches 포함 확장)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| BracketView (확장) | `currentUserEntryIds` prop | 본인 경기 식별 |
| ScoreInputModal | `Modal.tsx`, `Toast` | CLAUDE.md 필수 컴포넌트 |
| submitPlayerScore | `updateMatchResultCore` (공유 로직 추출) | 점수 저장 + 승자 전파 |
| getUserStats (확장) | bracket_matches + tournament_entries JOIN | 통계 |
| bracket page (확장) | getCurrentUser, tournament_entries | entry_ids 조회 |

---

## 3. Data Model

### 3.1 기존 테이블 활용 (신규 테이블 없음)

```
[tournament_entries]            [bracket_matches]
user_id ──(identifies)──→      team1_entry_id, team2_entry_id
                               winner_entry_id
                               team1_score, team2_score
                               sets_detail (JSON: SetDetail[])
                               status: SCHEDULED | COMPLETED | BYE
```

### 3.2 핵심 관계: 본인 경기 식별

```
user_id → tournament_entries.user_id → entry.id
  ↓
bracket_matches WHERE team1_entry_id = entry.id OR team2_entry_id = entry.id
  ↓
"본인 경기" 목록
```

### 3.3 통계 데이터 소스

현재 `getUserStats()`는 **matches 테이블**만 조회 (레거시).
bracket_matches 기반으로 확장:

```typescript
// bracket_matches 기반 통계 쿼리
// 1. 본인 entry_ids 조회
tournament_entries WHERE user_id = ? AND status = 'APPROVED'
  → entry_ids: string[]

// 2. 완료된 bracket_matches 조회
bracket_matches WHERE (team1_entry_id IN entry_ids OR team2_entry_id IN entry_ids)
  AND status = 'COMPLETED'
  → totalBracketMatches, bracketWins, bracketLosses

// 3. 기존 matches + bracket_matches 합산
```

---

## 4. Server Actions 설계

### 4.1 submitPlayerScore (신규)

**파일**: `src/lib/bracket/actions.ts`

```typescript
export async function submitPlayerScore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  setsDetail?: SetDetail[]
): Promise<{ error?: string; success?: boolean }>
```

**권한 검증 흐름**:
```
1. getCurrentUser() → user (로그인 확인)
2. validateId(matchId)
3. validateNonNegativeInteger(team1Score), validateNonNegativeInteger(team2Score)
4. team1Score === team2Score → 에러 (동점 거부)
5. bracket_matches.findById(matchId) → match
6. match.status !== 'SCHEDULED' → 에러 ("이미 완료된 경기입니다")
7. tournament_entries WHERE user_id = user.id → myEntryIds
8. match.team1_entry_id NOT IN myEntryIds AND match.team2_entry_id NOT IN myEntryIds
   → 에러 ("본인이 참가한 경기만 점수를 입력할 수 있습니다")
9. 점수 저장 + 승자 전파 (updateMatchResultCore 공유 로직)
10. return { success: true }
```

**승자 전파**: 기존 `updateMatchResult` 내부 로직을 `updateMatchResultCore`로 추출하여 공유.

### 4.2 updateMatchResultCore (내부 공유 함수 추출)

```typescript
// 기존 updateMatchResult에서 추출 — 외부 export 하지 않음
async function updateMatchResultCore(
  supabase: SupabaseClient,
  matchId: string,
  team1Score: number,
  team2Score: number,
  setsDetail?: SetDetail[]
): Promise<{ error?: string }>
```

포함 로직:
- bracket_matches UPDATE (score, status, completed_at, winner_entry_id)
- 하위 경기 승자 배정 (next_match_id, next_match_slot)
- 3/4위전 패자 배정 (loser_next_match_id)
- 예선인 경우 updateGroupStandings 호출

### 4.3 getPlayerEntryIds (신규 — bracket page용)

```typescript
export async function getPlayerEntryIds(
  tournamentId: string
): Promise<{ entryIds: string[]; error?: string }>
```

- getCurrentUser()
- tournament_entries WHERE tournament_id = ? AND user_id = ? AND status = 'APPROVED'
- return entry_id 목록

### 4.4 getUserStats 확장

**파일**: `src/lib/data/user.ts`

```typescript
export async function getUserStats() {
  // ... 기존 matches 테이블 조회 유지 ...

  // bracket_matches 기반 추가 통계
  // 1. 본인 entry_ids 조회
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'APPROVED')

  const entryIds = entries?.map(e => e.id) || []

  // 2. bracket_matches에서 완료된 경기 조회
  // team1_entry_id IN entryIds OR team2_entry_id IN entryIds
  // → bracketTotal, bracketWins 계산

  // 3. 합산 (중복 방지: bracket_matches 기준으로 통합)
  return {
    stats: {
      tournaments: tournamentCount,
      totalMatches: bracketTotal,      // bracket_matches 기준
      wins: bracketWins,
      losses: bracketTotal - bracketWins,
      winRate: bracketTotal ? Math.round((bracketWins / bracketTotal) * 100) : 0,
    }
  }
}
```

---

## 5. UI/UX Design

### 5.1 프로필 페이지 — 참가 대회 탭 수정

```
┌──────────────────────────────────────────────┐
│ 2024 봄 테니스 대회              [승인됨]     │
│ 📍 서울 테니스장                 진행 중      │
│                                              │
│ 신청일: 2024-03-01                           │
│                                              │
│ [🏆 대진표 보기]          [대회 상세보기 →]  │
│  ↑ IN_PROGRESS일 때만 표시                    │
└──────────────────────────────────────────────┘
```

**"대진표 보기" 버튼 표시 조건**:
```typescript
entry.status === 'APPROVED' && entry.tournament.status === 'IN_PROGRESS'
```

**클릭 시**: `/tournaments/${entry.tournament.id}/bracket` 이동

### 5.2 대진표 페이지 — 본인 경기 하이라이트

```
┌────── MatchCard (본인 경기) ──────────────┐
│  ┌─────────────────────────────────────┐  │
│  │ 🟢 나의 경기                         │  │ ← 본인 경기 배지
│  │                                     │  │
│  │ [홍길동 (나)]    3 : 1    김철수     │  │ ← 본인 이름 강조
│  │                                     │  │
│  │ [📝 점수 입력]   (SCHEDULED일 때만)  │  │ ← 점수 입력 버튼
│  └─────────────────────────────────────┘  │
│  border: 2px solid var(--accent-color)     │ ← 하이라이트 테두리
└───────────────────────────────────────────┘
```

**하이라이트 스타일**:
- 본인 경기: `border-2 border-(--accent-color)` + `bg-(--accent-color)/5`
- 본인 이름: `font-bold text-(--accent-color)`
- 비본인 경기: 기존 스타일 유지

### 5.3 ScoreInputModal — 개인전/복식

```
┌─── Modal ──────────────────────────────┐
│ × │ 점수 입력                           │
│─────────────────────────────────────────│
│                                         │
│  홍길동 (나)    vs    김철수             │
│                                         │
│  ┌─────────┐         ┌─────────┐       │
│  │   [ 3 ] │    :    │   [ 1 ] │       │
│  └─────────┘         └─────────┘       │
│                                         │
│  ⚠️ 동점은 입력할 수 없습니다           │
│                                         │
│─────────────────────────────────────────│
│  [ 취소 ]              [ 점수 저장 ]    │
└─────────────────────────────────────────┘
```

### 5.4 ScoreInputModal — 단체전

```
┌─── Modal (size="xl") ──────────────────────────┐
│ × │ 단체전 점수 입력                              │
│────────────────────────────────────────────────│
│                                                 │
│  A클럽  vs  B클럽                                │
│                                                 │
│  세트 1                                         │
│  ┌──────────────┐ vs ┌──────────────┐           │
│  │ [선수 선택 ▼] │    │ [선수 선택 ▼] │           │
│  └──────────────┘    └──────────────┘           │
│  점수: [ 4 ] : [ 2 ]                            │
│                                                 │
│  세트 2                                         │
│  ┌──────────────┐ vs ┌──────────────┐           │
│  │ [선수 선택 ▼] │    │ [선수 선택 ▼] │           │
│  └──────────────┘    └──────────────┘           │
│  점수: [ 3 ] : [ 4 ]                            │
│                                                 │
│  세트 3 (승부 결정 시 비활성화)                    │
│  ...                                            │
│                                                 │
│  현재 스코어: A클럽 1 - B클럽 1                   │
│                                                 │
│────────────────────────────────────────────────│
│  [ 취소 ]                    [ 점수 저장 ]       │
└────────────────────────────────────────────────┘
```

**단체전 로직** (기존 MatchDetailModal 참조):
- `teamMatchCount`만큼 세트 입력 UI 생성
- Best-of-N: `winsNeeded = Math.ceil(teamMatchCount / 2)`
- 승부 결정 후 나머지 세트 비활성화
- 선수 선택 시 이전 세트에서 사용한 선수 비활성화 (복식일 때)

### 5.5 통계 카드 (기존 대비 변경 없음, 데이터 소스만 확장)

```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  3   │ │  12  │ │   8  │ │   4  │ │ 67%  │
│참가  │ │총경기│ │ 승리 │ │ 패배 │ │ 승률 │
│대회  │ │      │ │      │ │      │ │      │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

변경점: 데이터가 bracket_matches 테이블 기준으로 계산됨.

---

## 6. Error Handling

### 6.1 서버 에러 시나리오

| 시나리오 | Server Action 응답 | UI 처리 |
|---------|-------------------|---------|
| 비로그인 상태 | `{ error: '로그인이 필요합니다.' }` | AlertDialog (error) |
| 본인 경기 아님 | `{ error: '본인이 참가한 경기만 점수를 입력할 수 있습니다.' }` | AlertDialog (error) |
| 이미 완료된 경기 | `{ error: '이미 완료된 경기입니다.' }` | AlertDialog (warning) |
| 동점 입력 | `{ error: '동점은 입력할 수 없습니다.' }` | 인라인 에러 메시지 |
| 서버 오류 | `{ error: '점수 입력에 실패했습니다.' }` | AlertDialog (error) |
| 성공 | `{ success: true }` | Toast (success, "점수가 저장되었습니다") |

### 6.2 동시 입력 충돌

양 선수가 동시에 같은 경기 점수를 입력하는 경우:
- 첫 번째 입력이 status를 COMPLETED로 변경
- 두 번째 입력은 "이미 완료된 경기입니다" 에러 반환
- 별도 lock 메커니즘 불필요 (Supabase 트랜잭션 일관성)

---

## 7. Security Considerations

- [x] **입력값 검증**: `validateId(matchId)`, `validateNonNegativeInteger(score)`, 동점 서버 사이드 거부
- [x] **권한 검증**: `getCurrentUser()` + `tournament_entries.user_id` 일치 확인
- [x] **경기 상태 확인**: `status === 'SCHEDULED'`만 입력 허용
- [x] **RLS**: bracket_matches SELECT는 public, UPDATE는 authenticated — 실제 권한은 Server Action에서 검증
- [x] **XSS 방지**: 점수는 숫자만 (문자열 입력 불가)
- [ ] Rate Limiting (v2 고려)

---

## 8. Implementation Guide

### 8.1 File Structure

```
수정 파일:
├── src/app/tournaments/[id]/bracket/page.tsx    # currentUserEntryIds prop 추가
├── src/components/tournaments/BracketView.tsx   # 하이라이트 + 점수 입력 기능
├── src/lib/bracket/actions.ts                   # submitPlayerScore + updateMatchResultCore 추출
├── src/lib/data/user.ts                         # getUserStats bracket_matches 확장
└── src/app/my/profile/page.tsx                  # "대진표 보기" 버튼 추가

신규 파일:
└── src/components/tournaments/ScoreInputModal.tsx  # 점수 입력 모달
```

### 8.2 Implementation Order

```
Phase 1: Server Actions (백엔드)
  1. [ ] updateMatchResultCore 공유 함수 추출 (기존 updateMatchResult 리팩토링)
  2. [ ] submitPlayerScore 신규 Server Action 구현
  3. [ ] getPlayerEntryIds 신규 Server Action 구현
  4. [ ] getUserStats bracket_matches 확장

Phase 2: 대진표 페이지 확장
  5. [ ] bracket/page.tsx: 로그인 유저 entry_ids 조회 → BracketView props 전달
  6. [ ] BracketView.tsx: currentUserEntryIds, matchType, teamMatchCount props 추가
  7. [ ] MatchCard/BracketMatchCard: 본인 경기 하이라이트 스타일
  8. [ ] MatchCard: SCHEDULED 본인 경기에 "점수 입력" 버튼

Phase 3: 점수 입력 모달
  9. [ ] ScoreInputModal 컴포넌트 구현 (개인전/복식)
  10. [ ] ScoreInputModal 단체전 모드 구현 (세트별 선수 배정)
  11. [ ] BracketView에서 ScoreInputModal 연동

Phase 4: 프로필 페이지
  12. [ ] 참가 대회 탭: IN_PROGRESS 대회에 "대진표 보기" 버튼 추가
  13. [ ] 통계 카드: bracket_matches 기반 데이터 확인
```

### 8.3 BracketView Props 확장 상세

```typescript
interface BracketViewProps {
  tournamentId: string
  divisions: Division[]
  // 신규 props (선택적 — 비로그인이면 undefined)
  currentUserEntryIds?: string[]    // 본인 entry ID 목록
  matchType?: MatchType | null      // 대회 종목 (단체전 여부 판단)
  teamMatchCount?: number | null    // 단체전 세트 수
}
```

비로그인 또는 비참가자인 경우 `currentUserEntryIds`가 undefined → 기존 읽기 전용 동작.

### 8.4 MatchCard/BracketMatchCard 하이라이트 로직

```typescript
function MatchCard({ match, currentUserEntryIds, onScoreInput }: {
  match: BracketMatch
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
}) {
  const isMyMatch = currentUserEntryIds?.some(
    id => id === match.team1_entry_id || id === match.team2_entry_id
  )
  const canInputScore = isMyMatch && match.status === 'SCHEDULED'
    && match.team1_entry_id && match.team2_entry_id  // 양쪽 팀 배정 완료

  return (
    <div className={isMyMatch ? 'border-2 border-(--accent-color) bg-(--accent-color)/5' : 'bg-(--bg-secondary)'}>
      {/* 경기 카드 내용 */}
      {canInputScore && (
        <button onClick={() => onScoreInput?.(match)}>점수 입력</button>
      )}
    </div>
  )
}
```

### 8.5 ScoreInputModal 상세

```typescript
interface ScoreInputModalProps {
  isOpen: boolean
  onClose: () => void
  match: BracketMatch
  matchType: MatchType | null
  teamMatchCount: number | null
  onSubmit: (team1Score: number, team2Score: number, setsDetail?: SetDetail[]) => Promise<void>
}
```

**개인전/복식 모드**: 단순 점수 입력 (team1Score, team2Score)
**단체전 모드**: 세트별 선수 배정 + 점수 → setsDetail 배열 생성

모달은 `Modal.tsx`를 사용하며, 성공/실패는 Toast/AlertDialog로 표시.

---

## 9. Coding Convention

### 9.1 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | PascalCase — `ScoreInputModal`, `BracketView` |
| File organization | 기존 경로 유지 (`src/components/tournaments/`) |
| State management | useState + useEffect (서버 데이터 중심) |
| Error handling | Server Action `{ error?: string }` 패턴 |
| Modal | `Modal.tsx` 필수 사용 (CLAUDE.md) |
| Alert/Toast | 성공 → Toast, 에러 → AlertDialog (CLAUDE.md) |
| Styling | Tailwind + CSS Variables (`var(--accent-color)`) |
| Import | 절대 경로 `@/components/...` |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-10 | Initial draft | AI Assistant |
