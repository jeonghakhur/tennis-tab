# Design: 클럽 정기 모임 일정 관리 (Club Session)

## 선행 작업: ENUM Drift 수정 (Migration 17)

### 문제
- DB `club_member_role` ENUM: `OWNER | ADMIN | MEMBER` (3개)
- TS `ClubMemberRole`: `OWNER | ADMIN | VICE_PRESIDENT | ADVISOR | MATCH_DIRECTOR | MEMBER` (6개)
- `checkClubOwnerAuth()`가 이미 `MATCH_DIRECTOR`를 참조 중이나 DB에 없어 권한 체크 무력화

### 수정 방법 (`17_fix_club_member_role_enum.sql`)
```sql
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'VICE_PRESIDENT';
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'ADVISOR';
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'MATCH_DIRECTOR';
```
> ⚠️ `ADD VALUE`는 트랜잭션 내에서 롤백 불가. 단독 실행 필요.

---

## DB 스키마 (Migration 18)

### ENUM 타입 추가

```sql
CREATE TYPE club_session_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE attendance_status AS ENUM ('ATTENDING', 'NOT_ATTENDING', 'UNDECIDED');
CREATE TYPE match_result_status AS ENUM ('SCHEDULED', 'COMPLETED', 'DISPUTED', 'CANCELLED');
```

### `club_sessions` 테이블

```sql
CREATE TABLE club_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  venue_name      TEXT NOT NULL,                      -- 코트장 이름
  court_numbers   TEXT[] NOT NULL DEFAULT '{}',       -- 사용 코트 배열 ex) {"1번","2번"}
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  max_attendees   INT,
  status          club_session_status NOT NULL DEFAULT 'OPEN',
  rsvp_deadline   TIMESTAMPTZ,                        -- NULL이면 세션 시작 전까지
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_session_time CHECK (end_time > start_time)
);
```

### `club_session_attendances` 테이블

```sql
CREATE TABLE club_session_attendances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  club_member_id  UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  status          attendance_status NOT NULL DEFAULT 'UNDECIDED',
  available_from  TIME,                               -- 참석 가능 시작
  available_until TIME,                               -- 참석 가능 종료
  notes           TEXT,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, club_member_id)
);
```

### `club_match_results` 테이블

```sql
CREATE TABLE club_match_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  player1_member_id    UUID NOT NULL REFERENCES club_members(id),
  player2_member_id    UUID NOT NULL REFERENCES club_members(id),
  court_number         TEXT,
  scheduled_time       TIME,
  player1_score        INT,
  player2_score        INT,
  winner_member_id     UUID REFERENCES club_members(id),
  status               match_result_status NOT NULL DEFAULT 'SCHEDULED',

  -- 분쟁 처리
  player1_reported_score_p1  INT,     -- player1이 신고한 자신의 점수
  player1_reported_score_p2  INT,
  player2_reported_score_p1  INT,
  player2_reported_score_p2  INT,
  dispute_resolved_by  UUID REFERENCES profiles(id),
  dispute_resolved_at  TIMESTAMPTZ,

  reported_by          UUID REFERENCES profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_different_players CHECK (player1_member_id <> player2_member_id)
);
```

### `club_member_stats` 테이블

```sql
CREATE TABLE club_member_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_member_id    UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  season            TEXT NOT NULL DEFAULT to_char(now(), 'YYYY'),  -- "2025"
  total_games       INT NOT NULL DEFAULT 0,
  wins              INT NOT NULL DEFAULT 0,
  losses            INT NOT NULL DEFAULT 0,
  win_rate          NUMERIC(5,2) GENERATED ALWAYS AS (
                      CASE WHEN total_games = 0 THEN 0
                      ELSE ROUND(wins::numeric / total_games * 100, 2)
                      END
                    ) STORED,
  sessions_attended INT NOT NULL DEFAULT 0,
  last_played_at    TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(club_id, club_member_id, season)
);
```

### 인덱스

```sql
CREATE INDEX idx_club_sessions_club_id      ON club_sessions(club_id);
CREATE INDEX idx_club_sessions_date         ON club_sessions(session_date);
CREATE INDEX idx_club_sessions_status       ON club_sessions(status);
CREATE INDEX idx_session_attendances_session ON club_session_attendances(session_id);
CREATE INDEX idx_session_attendances_member  ON club_session_attendances(club_member_id);
CREATE INDEX idx_club_match_results_session  ON club_match_results(session_id);
CREATE INDEX idx_club_match_results_player1  ON club_match_results(player1_member_id);
CREATE INDEX idx_club_match_results_player2  ON club_match_results(player2_member_id);
CREATE INDEX idx_club_member_stats_club      ON club_member_stats(club_id, season);
CREATE INDEX idx_club_member_stats_member    ON club_member_stats(club_member_id, season);
```

### RLS 정책

```sql
-- club_sessions
ALTER TABLE club_sessions ENABLE ROW LEVEL SECURITY;

-- 클럽 ACTIVE 멤버만 조회
CREATE POLICY "sessions_select" ON club_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

-- OWNER/ADMIN/MATCH_DIRECTOR만 생성
CREATE POLICY "sessions_insert" ON club_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY "sessions_update" ON club_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND status = 'ACTIVE'
    )
  );

-- club_session_attendances
ALTER TABLE club_session_attendances ENABLE ROW LEVEL SECURITY;

-- 같은 클럽 ACTIVE 멤버 전원 조회 가능 (누가 온다 가는지 알아야 하므로)
CREATE POLICY "attendances_select" ON club_session_attendances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_attendances.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- 자신의 멤버십에 해당하는 참석 응답만 생성
CREATE POLICY "attendances_insert" ON club_session_attendances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE id = club_session_attendances.club_member_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

-- 자신의 응답만 수정 (마감 여부는 Server Action에서 처리)
CREATE POLICY "attendances_update" ON club_session_attendances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE id = club_session_attendances.club_member_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

-- club_match_results
ALTER TABLE club_match_results ENABLE ROW LEVEL SECURITY;

-- 같은 클럽 멤버 조회 가능
CREATE POLICY "match_results_select" ON club_match_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- 경기에 참여한 두 선수(player1/player2)만 결과 등록 가능
-- (관리자도 생성 가능 — 대진 편성 시)
CREATE POLICY "match_results_insert" ON club_match_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN club_sessions cs ON cs.club_id = cm.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
        AND (
          cm.id IN (
            club_match_results.player1_member_id,
            club_match_results.player2_member_id
          )
          OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        )
    )
  );

CREATE POLICY "match_results_update" ON club_match_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      JOIN club_sessions cs ON cs.club_id = cm.club_id
      WHERE cs.id = club_match_results.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
        AND (
          cm.id IN (
            club_match_results.player1_member_id,
            club_match_results.player2_member_id
          )
          OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        )
    )
  );

-- club_member_stats
ALTER TABLE club_member_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_select" ON club_member_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_member_stats.club_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

-- 통계는 Server Action에서만 upsert (모든 INSERT/UPDATE는 admin client 사용)
```

---

## 파일 구조

```
supabase/migrations/
├── 17_fix_club_member_role_enum.sql   ← ENUM drift 수정 (선행)
└── 18_club_sessions.sql               ← 세션 기능 전체

src/
├── lib/
│   └── clubs/
│       ├── types.ts                   ← ClubSession*, Attendance*, MatchResult* 타입 추가
│       └── session-actions.ts         ← 세션 전용 Server Actions (actions.ts 분리)
│
└── app/
    └── clubs/
        └── [id]/
            ├── page.tsx               ← 탭 목록에 'sessions' | 'rankings' 추가
            └── sessions/
                └── [sessionId]/
                    ├── page.tsx       ← 세션 상세 (일정 + 참석 응답 + 대진표 + 결과)
                    └── manage/
                        └── page.tsx   ← 관리자 전용 (참석자 확정 + 대진 편성)

src/components/
└── clubs/
    └── sessions/
        ├── SessionCard.tsx            ← 세션 카드 (목록용)
        ├── SessionList.tsx            ← 세션 목록 (예정/완료 탭)
        ├── AttendanceForm.tsx         ← 참석 응답 폼 (참석/불참 + 시간 선택)
        ├── AttendanceList.tsx         ← 참석자 현황 (응답/미응답 구분)
        ├── MatchBoard.tsx             ← 경기 목록 + 내 경기 하이라이트
        ├── MatchResultForm.tsx        ← 결과 입력 모달
        ├── BracketEditor.tsx          ← 관리자 대진 편성 UI
        └── RankingsTab.tsx            ← 클럽 순위표
```

---

## Server Actions API (`src/lib/clubs/session-actions.ts`)

### 세션 CRUD

```typescript
// 세션 생성
createClubSession(input: CreateSessionInput): Promise<{ data?: ClubSession; error?: string }>

// 세션 목록 (클럽 내 예정/완료 구분)
getClubSessions(clubId: string, options?: { status?: ClubSessionStatus[]; limit?: number }): Promise<ClubSession[]>

// 세션 상세 (attendances 포함)
getClubSessionDetail(sessionId: string): Promise<ClubSessionDetail | null>

// 세션 수정 (OPEN 상태만 가능)
updateClubSession(sessionId: string, input: UpdateSessionInput): Promise<{ error?: string }>

// 세션 취소
cancelClubSession(sessionId: string): Promise<{ error?: string }>

// 응답 마감 (OPEN → CLOSED)
closeSessionRsvp(sessionId: string): Promise<{ error?: string }>
```

### 참석 응답

```typescript
// 참석 응답 등록/수정 (upsert)
respondToSession(input: RespondSessionInput): Promise<{ error?: string }>
// - 마감 여부 서버에서 체크
// - rsvp_deadline 지났으면 에러 반환

// 참석자 목록 (관리자용 — 미응답 포함)
getSessionAttendances(sessionId: string): Promise<SessionAttendanceDetail[]>
```

### 경기 결과

```typescript
// 대진 생성 (관리자) — 라운드로빈 자동 or 수동 1건씩
createMatchResult(input: CreateMatchInput): Promise<{ data?: ClubMatchResult; error?: string }>
createRoundRobinMatches(sessionId: string, memberIds: string[]): Promise<{ count: number; error?: string }>

// 결과 보고 (선수)
reportMatchResult(matchId: string, input: ReportResultInput): Promise<{ error?: string }>
// - 양측 모두 보고 + 일치 → status = COMPLETED, winner_member_id 설정, stats 갱신
// - 불일치 → status = DISPUTED

// 분쟁 해결 (관리자)
resolveMatchDispute(matchId: string, input: ResolveDisputeInput): Promise<{ error?: string }>
// - 최종 점수 결정 → COMPLETED + stats 갱신

// 경기 목록 (세션 내)
getSessionMatches(sessionId: string): Promise<ClubMatchResult[]>
```

### 통계

```typescript
// 클럽 순위 조회
getClubRankings(clubId: string, season?: string): Promise<ClubMemberStatWithMember[]>

// 내 통계 조회
getMyClubStats(clubId: string, season?: string): Promise<ClubMemberStat | null>
```

### 통계 갱신 내부 함수 (export 안 함)

```typescript
// 경기 확정 시 호출 — UPSERT into club_member_stats
// admin client 사용 (RLS bypass)
async function updateStatsAfterMatch(
  match: ClubMatchResult,
  clubId: string
): Promise<void>
```

---

## TypeScript 타입 (`src/lib/clubs/types.ts` 추가)

```typescript
export type ClubSessionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'COMPLETED'
export type AttendanceStatus = 'ATTENDING' | 'NOT_ATTENDING' | 'UNDECIDED'
export type MatchResultStatus = 'SCHEDULED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED'

export interface ClubSession {
  id: string
  club_id: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string           // ISO date "2025-03-15"
  start_time: string             // "09:00"
  end_time: string               // "12:00"
  max_attendees: number | null
  status: ClubSessionStatus
  rsvp_deadline: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // JOIN 결과
  _attending_count?: number
  _not_attending_count?: number
  _undecided_count?: number
  _my_attendance?: AttendanceStatus
}

export interface ClubSessionDetail extends ClubSession {
  attendances: SessionAttendanceDetail[]
  matches: ClubMatchResult[]
}

export interface SessionAttendanceDetail {
  id: string
  session_id: string
  club_member_id: string
  status: AttendanceStatus
  available_from: string | null
  available_until: string | null
  notes: string | null
  responded_at: string | null
  // JOIN
  member: { id: string; name: string; rating: number | null; is_registered: boolean }
}

export interface ClubMatchResult {
  id: string
  session_id: string
  player1_member_id: string
  player2_member_id: string
  court_number: string | null
  scheduled_time: string | null
  player1_score: number | null
  player2_score: number | null
  winner_member_id: string | null
  status: MatchResultStatus
  player1_reported_score_p1: number | null
  player1_reported_score_p2: number | null
  player2_reported_score_p1: number | null
  player2_reported_score_p2: number | null
  created_at: string
  updated_at: string
  // JOIN
  player1?: { id: string; name: string }
  player2?: { id: string; name: string }
}

export interface ClubMemberStat {
  id: string
  club_id: string
  club_member_id: string
  season: string
  total_games: number
  wins: number
  losses: number
  win_rate: number
  sessions_attended: number
  last_played_at: string | null
}

export interface ClubMemberStatWithMember extends ClubMemberStat {
  member: { id: string; name: string; rating: number | null }
}

// Server Action 입력 타입
export interface CreateSessionInput {
  club_id: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string
  start_time: string
  end_time: string
  max_attendees?: number
  rsvp_deadline?: string
  notes?: string
}

export interface RespondSessionInput {
  session_id: string
  club_member_id: string
  status: AttendanceStatus
  available_from?: string
  available_until?: string
  notes?: string
}

export interface ReportResultInput {
  my_score: number
  opponent_score: number
}

export interface ResolveDisputeInput {
  player1_score: number
  player2_score: number
}
```

---

## 컴포넌트 설계

### `SessionCard.tsx`
- props: `session: ClubSession`, `onClick: () => void`
- 표시: 날짜, 코트장, 시간, 참석 현황 (O/X/?)
- 내 응답 상태에 따른 색상 강조 (`ATTENDING`→초록, `NOT_ATTENDING`→회색, `UNDECIDED`→주황)
- 마감 여부 뱃지 (`CLOSED` → `<Badge variant="secondary">마감</Badge>`)

### `AttendanceForm.tsx`
- 3버튼 라디오 UI: "참석", "불참", "미정"
- 참석 선택 시: 시간 선택 슬라이더 or `<input type="time">` (available_from ~ available_until)
- 메모 입력 (선택)
- `noValidate` form + AlertDialog 에러 처리

### `BracketEditor.tsx` (관리자 전용)
- 참석 확정 회원 목록 표시
- 두 가지 모드:
  1. **자동 생성**: "라운드로빈 생성" 버튼 → `createRoundRobinMatches()` 호출
  2. **수동 추가**: player1/player2 선택 드롭다운 + 코트번호 + 시간 입력 → 1건씩 추가
- 생성된 경기 목록 표시 + 삭제 가능

### `MatchResultForm.tsx` (Modal 사용)
- 상대방 이름 표시
- 내 점수 / 상대 점수 숫자 입력
- 제출 시: `reportMatchResult()` 호출
- 분쟁 상태 시: 관리자에게 알림 표시

### `RankingsTab.tsx`
- 시즌 선택 `<select>` (현재 연도 기본값)
- 순위표: 순위, 이름, 게임수, 승/패, 승률
- 내 행 `bg-emerald-500/10` 하이라이트

---

## 페이지 라우트 변경

### `/clubs/[id]/page.tsx` 탭 추가

```typescript
type TabType = 'info' | 'sessions' | 'rankings' | 'awards' | 'manage'
```

| 탭 | 표시 조건 |
|----|----------|
| 정보 | 항상 |
| 모임 | 클럽 멤버 (ACTIVE) |
| 순위 | 클럽 멤버 (ACTIVE) |
| 입상 | 항상 |
| 관리 | OWNER/ADMIN/MATCH_DIRECTOR |

### `/clubs/[id]/sessions/[sessionId]/page.tsx` (신규)

```
세션 상세 페이지
├── 헤더: 세션 제목, 날짜, 코트장, 시간, 메모
├── 참석 응답 섹션 (OPEN 상태 + 마감 전)
│   └── AttendanceForm (내 응답)
├── 참석자 현황 섹션
│   └── AttendanceList (참석N, 불참N, 미정N)
├── 대진표 섹션 (matches 있을 때)
│   └── MatchBoard
└── 관리 버튼 (isOfficer → /manage 링크)
```

### `/clubs/[id]/sessions/[sessionId]/manage/page.tsx` (신규, 관리자 전용)

```
관리 페이지
├── 참석자 목록 (전체, 미응답 포함)
├── 응답 마감 버튼 (OPEN → CLOSED)
├── 대진 편성 섹션
│   └── BracketEditor
└── 세션 완료 처리 버튼
```

---

## 구현 순서 (Do 단계 체크리스트)

### Step 1: DB 마이그레이션 (선행 필수)
- [ ] `17_fix_club_member_role_enum.sql` 작성 + 적용
- [ ] `18_club_sessions.sql` 작성 + 적용
- [ ] Supabase Dashboard에서 RLS 정책 동작 확인

### Step 2: 타입 정의
- [ ] `src/lib/clubs/types.ts`에 세션 관련 타입 추가

### Step 3: Server Actions
- [ ] `src/lib/clubs/session-actions.ts` 파일 생성
- [ ] 세션 CRUD 구현
- [ ] 참석 응답 구현 (upsert + 마감 체크)
- [ ] 경기 생성/결과 보고/분쟁 해결 구현
- [ ] `updateStatsAfterMatch()` 내부 함수 구현
- [ ] 순위 조회 구현

### Step 4: 컴포넌트 구현
- [ ] `SessionCard.tsx`
- [ ] `SessionList.tsx`
- [ ] `AttendanceForm.tsx`
- [ ] `AttendanceList.tsx`
- [ ] `MatchBoard.tsx` + `MatchResultForm.tsx`
- [ ] `BracketEditor.tsx`
- [ ] `RankingsTab.tsx`
- [ ] 세션 생성 모달 (`SessionForm.tsx`)

### Step 5: 페이지 연결
- [ ] `/clubs/[id]/page.tsx` — 탭 추가 (`sessions`, `rankings`)
- [ ] `/clubs/[id]/sessions/[sessionId]/page.tsx` — 신규
- [ ] `/clubs/[id]/sessions/[sessionId]/manage/page.tsx` — 신규

---

## 권한 체크 매트릭스

| Action | 구현 위치 | 체크 방법 |
|--------|-----------|-----------|
| 세션 생성 | Server Action | `club_member.role IN ('OWNER','ADMIN','MATCH_DIRECTOR')` |
| 참석 응답 | Server Action | `club_member.user_id = auth.uid()` + 마감 체크 |
| 대진 생성 | Server Action | `club_member.role IN ('OWNER','ADMIN','MATCH_DIRECTOR')` |
| 결과 보고 | Server Action | `club_member.id IN (player1_member_id, player2_member_id)` |
| 분쟁 해결 | Server Action | `club_member.role IN ('OWNER','ADMIN','MATCH_DIRECTOR')` |
| 세션 완료 | Server Action | `club_member.role IN ('OWNER','ADMIN','MATCH_DIRECTOR')` |

> 모든 mutation은 admin client로 실행 + 서버 사이드 권한 체크 병행 (RLS는 2차 방어선)

---

## 미결정 사항 (구현 시 결정)

1. **대진 자동 생성 시 코트 배분**: 라운드로빈으로 만든 경기에 코트를 자동 배분할지? (현재는 관리자 수동)
2. **참석 시간 겹침 기반 매칭**: Phase 2로 미룸 (MVP에서는 단순 라운드로빈)
3. **세션 생성 폼 위치**: 클럽 상세 "모임" 탭 내 인라인 vs 별도 모달 → **Modal 방식으로 결정**
