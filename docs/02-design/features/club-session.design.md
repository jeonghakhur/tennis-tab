# Design: 클럽 정기 모임 일정 관리 (Club Session)

> **구현 상태**: 완료 ✅

---

## 선행 작업: ENUM Drift 수정 (Migration 17)

```sql
-- 17_fix_club_member_role_enum.sql
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'VICE_PRESIDENT';
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'ADVISOR';
ALTER TYPE club_member_role ADD VALUE IF NOT EXISTS 'MATCH_DIRECTOR';
```

> ⚠️ `ADD VALUE`는 트랜잭션 내에서 롤백 불가. 단독 실행 필요.

---

## DB 스키마 (Migration 19)

### ENUM 타입

```sql
CREATE TYPE club_session_status   AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');
CREATE TYPE attendance_status     AS ENUM ('ATTENDING', 'NOT_ATTENDING', 'UNDECIDED');
CREATE TYPE match_result_status   AS ENUM ('SCHEDULED', 'COMPLETED', 'DISPUTED', 'CANCELLED');
CREATE TYPE club_match_type       AS ENUM (
  'singles', 'doubles', 'doubles_men', 'doubles_women', 'doubles_mixed'
);
```

### `club_sessions` 테이블

```sql
CREATE TABLE club_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  venue_name      TEXT NOT NULL,
  court_numbers   TEXT[] NOT NULL DEFAULT '{}',
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  max_attendees   INT,
  status          club_session_status NOT NULL DEFAULT 'OPEN',
  rsvp_deadline   TIMESTAMPTZ,           -- NULL이면 세션 시작 전까지
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
  available_from  TIME,
  available_until TIME,
  notes           TEXT,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, club_member_id)
);
```

### `club_session_guests` 테이블

```sql
CREATE TABLE club_session_guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  gender          TEXT,
  available_from  TIME,
  available_until TIME,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `club_match_results` 테이블

```sql
CREATE TABLE club_match_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  match_type               club_match_type NOT NULL DEFAULT 'doubles',

  -- 1팀 (싱글스: player1만, 복식: player1 + player1b)
  player1_member_id        UUID REFERENCES club_members(id),   -- nullable (게스트 대체 가능)
  player1b_member_id       UUID REFERENCES club_members(id),   -- 복식 파트너
  player1_guest_id         UUID REFERENCES club_session_guests(id),
  player1b_guest_id        UUID REFERENCES club_session_guests(id),

  -- 2팀
  player2_member_id        UUID REFERENCES club_members(id),
  player2b_member_id       UUID REFERENCES club_members(id),
  player2_guest_id         UUID REFERENCES club_session_guests(id),
  player2b_guest_id        UUID REFERENCES club_session_guests(id),

  court_number             TEXT,
  scheduled_time           TIME,
  player1_score            INT,
  player2_score            INT,
  winner_member_id         UUID REFERENCES club_members(id),
  status                   match_result_status NOT NULL DEFAULT 'SCHEDULED',

  -- 분쟁 처리
  player1_reported_score_p1  INT,
  player1_reported_score_p2  INT,
  player2_reported_score_p1  INT,
  player2_reported_score_p2  INT,
  dispute_resolved_by      UUID REFERENCES profiles(id),
  dispute_resolved_at      TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `club_member_stats` 테이블

```sql
CREATE TABLE club_member_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_member_id    UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  season            TEXT NOT NULL DEFAULT to_char(now(), 'YYYY'),
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

### `club_session_comments` 테이블 (Migration 30)

```sql
CREATE TABLE club_session_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 인덱스

```sql
CREATE INDEX idx_club_sessions_club_id        ON club_sessions(club_id);
CREATE INDEX idx_club_sessions_date           ON club_sessions(session_date);
CREATE INDEX idx_club_sessions_status         ON club_sessions(status);
CREATE INDEX idx_session_attendances_session  ON club_session_attendances(session_id);
CREATE INDEX idx_session_attendances_member   ON club_session_attendances(club_member_id);
CREATE INDEX idx_club_match_results_session   ON club_match_results(session_id);
CREATE INDEX idx_club_match_results_player1   ON club_match_results(player1_member_id);
CREATE INDEX idx_club_match_results_player2   ON club_match_results(player2_member_id);
CREATE INDEX idx_club_member_stats_club       ON club_member_stats(club_id, season);
CREATE INDEX idx_club_member_stats_member     ON club_member_stats(club_member_id, season);
```

### RLS 정책

```sql
-- club_sessions: ACTIVE 멤버 조회, 임원만 CUD
ALTER TABLE club_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON club_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = club_sessions.club_id
      AND user_id = auth.uid() AND status = 'ACTIVE'
  ));

CREATE POLICY "sessions_insert" ON club_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = club_sessions.club_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND status = 'ACTIVE'
    )
  );

CREATE POLICY "sessions_update" ON club_sessions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = club_sessions.club_id
      AND user_id = auth.uid()
      AND role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
      AND status = 'ACTIVE'
  ));

-- club_session_attendances: ACTIVE 멤버 조회, 본인 응답 CUD
ALTER TABLE club_session_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendances_select" ON club_session_attendances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_sessions cs
    JOIN club_members cm ON cm.club_id = cs.club_id
    WHERE cs.id = club_session_attendances.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
  ));

CREATE POLICY "attendances_insert" ON club_session_attendances FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM club_members
    WHERE id = club_session_attendances.club_member_id
      AND user_id = auth.uid() AND status = 'ACTIVE'
  ));

CREATE POLICY "attendances_update" ON club_session_attendances FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM club_members
    WHERE id = club_session_attendances.club_member_id
      AND user_id = auth.uid() AND status = 'ACTIVE'
  ));

-- club_match_results: ACTIVE 멤버 조회, 선수/임원 CUD
ALTER TABLE club_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_select" ON club_match_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_sessions cs
    JOIN club_members cm ON cm.club_id = cs.club_id
    WHERE cs.id = club_match_results.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
  ));

CREATE POLICY "match_results_insert" ON club_match_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM club_members cm
    JOIN club_sessions cs ON cs.club_id = cm.club_id
    WHERE cs.id = club_match_results.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
      AND (
        cm.id IN (club_match_results.player1_member_id, club_match_results.player2_member_id)
        OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
      )
  ));

CREATE POLICY "match_results_update" ON club_match_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM club_members cm
    JOIN club_sessions cs ON cs.club_id = cm.club_id
    WHERE cs.id = club_match_results.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
      AND (
        cm.id IN (club_match_results.player1_member_id, club_match_results.player2_member_id)
        OR cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
      )
  ));

-- club_member_stats: ACTIVE 멤버 조회, INSERT/UPDATE는 admin client 전용
ALTER TABLE club_member_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_select" ON club_member_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = club_member_stats.club_id
      AND user_id = auth.uid() AND status = 'ACTIVE'
  ));

-- club_session_comments: ACTIVE 멤버 조회/생성, 본인/임원 삭제
ALTER TABLE club_session_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON club_session_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_sessions cs
    JOIN club_members cm ON cm.club_id = cs.club_id
    WHERE cs.id = club_session_comments.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
  ));

CREATE POLICY "comments_insert" ON club_session_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM club_sessions cs
    JOIN club_members cm ON cm.club_id = cs.club_id
    WHERE cs.id = club_session_comments.session_id
      AND cm.user_id = auth.uid() AND cm.status = 'ACTIVE'
  ));

CREATE POLICY "comments_delete" ON club_session_comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_comments.session_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
        AND cm.status = 'ACTIVE'
    )
  );
```

---

## 파일 구조

```
supabase/migrations/
├── 17_fix_club_member_role_enum.sql   ← ENUM drift 수정
├── 19_club_sessions.sql               ← 세션 핵심 테이블 4개
└── 30_club_session_comments.sql       ← 댓글 테이블

src/
├── lib/clubs/
│   ├── types.ts                       ← 전체 타입 정의
│   ├── session-actions.ts             ← 세션 Server Actions (30+ 함수)
│   └── actions.ts                     ← 클럽 관리 Server Actions
│
└── app/clubs/[id]/
    ├── page.tsx                       ← 클럽 상세 (sessions / rankings 탭 포함)
    └── sessions/[sessionId]/
        ├── page.tsx                   ← 세션 상세 (일반 멤버)
        └── manage/page.tsx            ← 세션 관리 (임원 전용)

src/components/clubs/sessions/
├── SessionForm.tsx                    ← 세션 생성/수정 모달
├── SessionCard.tsx                    ← 세션 카드 (목록용)
├── SessionList.tsx                    ← 세션 목록 (예정/완료 탭)
├── SessionDatePicker.tsx              ← 날짜 선택
├── SessionTimePicker.tsx              ← 시간 선택 (HH:MM)
├── AttendanceForm.tsx                 ← 참석 응답 폼
├── AttendanceList.tsx                 ← 참석자 현황 + 게스트 관리
├── BracketEditor.tsx                  ← 대진 수동/자동 편성 (임원)
├── MatchBoard.tsx                     ← 경기 결과 보드
├── MatchResultForm.tsx                ← 점수 입력 / 분쟁 해결 모달
├── SessionCommentSection.tsx          ← 댓글 CRUD
├── RankingsTab.tsx                    ← 순위표 (RankingPeriod 필터)
└── YearMonthPicker.tsx                ← 년월 선택
```

---

## TypeScript 타입 (`src/lib/clubs/types.ts`)

```typescript
export type ClubSessionStatus  = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'COMPLETED'
export type AttendanceStatus   = 'ATTENDING' | 'NOT_ATTENDING' | 'UNDECIDED'
export type MatchResultStatus  = 'SCHEDULED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED'
export type MatchType          = 'singles' | 'doubles' | 'doubles_men' | 'doubles_women' | 'doubles_mixed'
export type RankingPeriod      = 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'

export interface ClubSession {
  id: string
  club_id: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string           // "2025-03-15"
  start_time: string             // "09:00:00"
  end_time: string
  max_attendees: number | null
  status: ClubSessionStatus
  rsvp_deadline: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // 목록 조회 시 JOIN 집계
  _attending_count?: number
  _not_attending_count?: number
  _undecided_count?: number
  _my_attendance?: AttendanceStatus
}

export interface ClubSessionDetail extends ClubSession {
  attendances: SessionAttendanceDetail[]
  matches: ClubMatchResult[]
  guests: ClubSessionGuest[]     // 게스트 포함
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
  member: { id: string; name: string; rating: number | null; is_registered: boolean; gender?: string }
}

export interface ClubSessionGuest {
  id: string
  session_id: string
  name: string
  gender: string | null
  available_from: string | null
  available_until: string | null
  notes: string | null
  created_by: string
  created_at: string
}

// 자동 대진 생성용 플레이어 풀 (멤버 + 게스트 통합)
export type SchedulePlayer =
  | { type: 'member'; memberId: string; availableFrom: number; availableUntil: number }
  | { type: 'guest';  guestId: string;  availableFrom: number; availableUntil: number }

export interface ClubMatchResult {
  id: string
  session_id: string
  match_type: MatchType
  // nullable: 멤버 또는 게스트 중 하나만 채워짐
  player1_member_id: string | null
  player1b_member_id: string | null
  player2_member_id: string | null
  player2b_member_id: string | null
  player1_guest_id: string | null
  player1b_guest_id: string | null
  player2_guest_id: string | null
  player2b_guest_id: string | null
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
  dispute_resolved_by: string | null
  dispute_resolved_at: string | null
  created_at: string
  updated_at: string
  // JOIN
  player1?: { id: string; name: string }
  player1b?: { id: string; name: string }
  player2?: { id: string; name: string }
  player2b?: { id: string; name: string }
  player1_guest?: ClubSessionGuest
  player1b_guest?: ClubSessionGuest
  player2_guest?: ClubSessionGuest
  player2b_guest?: ClubSessionGuest
}

export interface ClubSessionComment {
  id: string
  session_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: { name: string }
}

export interface ClubMemberStat {
  id: string
  club_id: string
  club_member_id: string
  season: string
  total_games: number
  wins: number
  losses: number
  win_rate: number              // GENERATED ALWAYS
  sessions_attended: number
  last_played_at: string | null
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

export interface CreateMatchInput {
  session_id: string
  match_type?: MatchType
  player1_member_id?: string
  player1b_member_id?: string
  player2_member_id?: string
  player2b_member_id?: string
  player1_guest_id?: string
  player1b_guest_id?: string
  player2_guest_id?: string
  player2b_guest_id?: string
  court_number?: string
  scheduled_time?: string
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

## Server Actions API (`src/lib/clubs/session-actions.ts`)

### 세션 CRUD

```typescript
createClubSession(input: CreateSessionInput): Promise<{ data?: ClubSession; error?: string }>
getClubSessions(clubId: string, options?: { status?: ClubSessionStatus[]; limit?: number }): Promise<ClubSession[]>
getClubSessionDetail(sessionId: string): Promise<ClubSessionDetail | null>
getSessionPageData(sessionId: string, clubId: string): Promise<{ session, myMemberId, myRole }>
updateClubSession(sessionId: string, input: Partial<CreateSessionInput>): Promise<{ error?: string }>
  // OPEN 상태만 수정 가능
cancelClubSession(sessionId: string): Promise<{ error?: string }>
deleteClubSession(sessionId: string): Promise<{ error?: string }>
  // OPEN 상태만 삭제 가능
changeSessionStatus(sessionId: string, newStatus: ClubSessionStatus): Promise<{ error?: string }>
```

### 참석 응답

```typescript
respondToSession(input: RespondSessionInput): Promise<{ error?: string }>
  // upsert, rsvp_deadline / CLOSED 상태 서버에서 체크
cancelAttendance(sessionId: string, clubMemberId: string): Promise<{ error?: string }>
  // 레코드 완전 삭제 (상태 변경 아님)
getSessionAttendances(sessionId: string): Promise<SessionAttendanceDetail[]>
closeSessionRsvp(sessionId: string): Promise<{ error?: string }>
  // OPEN → CLOSED
```

### 게스트 관리

```typescript
getSessionGuests(sessionId: string): Promise<ClubSessionGuest[]>
addSessionGuest(sessionId: string, guestData: {...}): Promise<{ data?: ClubSessionGuest; error?: string }>
  // 임원만, OPEN/CLOSED 상태만
removeSessionGuest(guestId: string): Promise<{ error?: string }>
  // 완료된 경기 참여 게스트 삭제 불가
```

### 경기 결과

```typescript
createMatchResult(input: CreateMatchInput): Promise<{ data?: ClubMatchResult; error?: string }>
  // 중복 선수 체크 포함
createAutoScheduleMatches(sessionId: string, matchDurationMinutes?: number): Promise<{ count: number; error?: string }>
  // 시간 슬롯 기반 자동 복식 대진 생성 (최소 4명 필요)
  // 게임 수 공정 배분, 강약 교차 팀 구성, 중복 대전 방지, 코트 자동 배치
updateMatchResult(matchId: string, updates: Partial<CreateMatchInput>): Promise<{ error?: string }>
deleteMatchResult(matchId: string): Promise<{ error?: string }>
  // SCHEDULED 상태만 삭제 가능
deleteAllMatchResults(sessionId: string): Promise<{ error?: string }>
  // SCHEDULED 상태 전체 삭제
getSessionMatches(sessionId: string): Promise<ClubMatchResult[]>
reportMatchResult(matchId: string, reporterMemberId: string, input: ReportResultInput): Promise<{ error?: string }>
  // 양측 일치 → COMPLETED 자동 확정 + stats 갱신
  // 불일치 → DISPUTED
resolveMatchDispute(matchId: string, input: ResolveDisputeInput): Promise<{ error?: string }>
  // 임원만, DISPUTED → COMPLETED
adminOverrideMatchResult(matchId: string, input: ResolveDisputeInput): Promise<{ error?: string }>
  // 임원 강제 수정
```

### 통계 / 순위

```typescript
completeSession(sessionId: string): Promise<{ error?: string }>
  // CLOSED → COMPLETED + ATTENDING 회원 sessions_attended++ 갱신
getClubRankings(clubId: string, season?: string): Promise<ClubMemberStatWithMember[]>
getClubRankingsByPeriod(clubId: string, period: RankingPeriod, customFrom?: string, customTo?: string): Promise<RankingEntry[]>
getClubDefaultRankingPeriod(clubId: string): Promise<{ period, from, to } | null>
updateClubDefaultRankingPeriod(clubId: string, period: RankingPeriod, customFrom?: string, customTo?: string): Promise<{ error?: string }>
getMyClubStats(memberId: string, clubId: string, season?: string): Promise<ClubMemberStat | null>
getMemberGameResults(memberId: string, options?: { period?: RankingPeriod; clubId?: string }): Promise<MemberGameResult[]>
```

### 댓글

```typescript
getSessionComments(sessionId: string): Promise<ClubSessionComment[]>
createSessionComment(sessionId: string, content: string): Promise<{ data?: ClubSessionComment; error?: string }>
  // ACTIVE 멤버만, 1000자 이내
deleteSessionComment(commentId: string, sessionId: string): Promise<{ error?: string }>
  // 본인 또는 임원만
```

---

## 컴포넌트 설계

### `SessionCard.tsx`
- props: `session: ClubSession`
- 표시: 날짜, 코트장, 시간, 응답 현황 (참석N/불참N/미응답N)
- 내 응답 상태 색상: `ATTENDING`→초록, `NOT_ATTENDING`→회색, `UNDECIDED`→주황
- 상태 뱃지: `CLOSED`→마감, `COMPLETED`→완료, `CANCELLED`→취소

### `AttendanceForm.tsx`
- props: `sessionId, clubMemberId, currentStatus?, isEditMode?`
- 3버튼 라디오: "참석 ✓", "불참 ✗", "미정 ?"
- 참석 선택 시: `available_from / available_until` `<input type="time">` 표시
- `noValidate` form + AlertDialog 에러 처리

### `AttendanceList.tsx`
- props: `attendances[], guests[], isOfficer?, onGuestsChange?`
- 참석자 현황 (응답/미응답 구분)
- 임원: 게스트 추가/삭제 UI 포함

### `BracketEditor.tsx` (임원 전용)
- props: `sessionId, attendingMembers[], guests[], matches[], courtNumbers[]`
- **자동 생성**: 버튼 클릭 → `createAutoScheduleMatches()` (시간 슬롯 기반 복식)
- **수동 추가**: player1/2 + 파트너 선택 드롭다운 (멤버/게스트 구분) + 코트 + 시간
- 생성된 경기 목록 표시 + 삭제 (SCHEDULED만)

### `MatchBoard.tsx`
- props: `matches[], myMemberId?, canInputScore?, isOfficer?`
- 경기 결과 카드 목록
- 결과 입력 권한: `isOfficer` 또는 (게스트 없음 + CLOSED + 시작 후 + 내 경기 + SCHEDULED)
- 분쟁(DISPUTED) 경기: 임원에게 해결 UI 표시

### `MatchResultForm.tsx` (Modal)
- 상대방 이름/팀 표시
- 내 점수 / 상대 점수 숫자 입력
- 임원용: 최종 점수 직접 지정 (분쟁 해결 / 강제 수정)

### `SessionCommentSection.tsx`
- props: `sessionId, currentUserId?, isOfficer?`
- 댓글 목록 (작성자명 + 시간)
- 댓글 작성 textarea + 제출 버튼 (1000자 제한)
- 본인/임원: 삭제 버튼 표시

### `RankingsTab.tsx`
- props: `clubId`
- `RankingPeriod` 선택 드롭다운 (전체/이번달/지난달/이번년/지난년/커스텀)
- 커스텀 선택 시 날짜 범위 picker
- 순위표: 순위, 이름, 게임수, 승/패, 승률
- 내 행 `bg-emerald-500/10` 하이라이트

---

## 페이지 구성

### `/clubs/[id]/page.tsx` 탭

```typescript
type TabType = 'info' | 'sessions' | 'rankings' | 'awards' | 'manage'
```

| 탭 | 표시 조건 |
|----|----------|
| 정보 | 항상 |
| 모임 | ACTIVE 클럽 멤버 |
| 순위 | ACTIVE 클럽 멤버 |
| 입상 | 항상 |
| 관리 | OWNER / ADMIN / MATCH_DIRECTOR |

### `/clubs/[id]/sessions/[sessionId]/page.tsx`

```
세션 상세 (일반 뷰)
├── 헤더: 제목, 상태 배지, 날짜/시간/장소/정원
├── 임원 버튼: 수정 | 관리 | 삭제(OPEN만)
├── AttendanceForm (OPEN + 마감 전)
├── AttendanceList (참석/불참/미응답, 임원: 게스트 관리)
├── MatchBoard (CLOSED 이후 표시)
└── SessionCommentSection (하단)
```

### `/clubs/[id]/sessions/[sessionId]/manage/page.tsx`

```
세션 관리 (임원 전용)
├── 상태 액션 버튼: 응답 마감 | 모임 완료 | 취소
├── AttendanceList (미응답 멤버 포함, 게스트 추가)
└── BracketEditor (수동/자동 대진, 삭제)
```

---

## 자동 대진 알고리즘

```
createAutoScheduleMatches(sessionId, matchDuration=30)

1. SchedulePlayer 풀 구성
   - ATTENDING 멤버: availableFrom/Until → 분 단위 변환
   - 게스트: 동일 처리
   → 최소 4명 미만이면 에러

2. 시간 슬롯 순회 (start_time ~ end_time, matchDuration 간격)
   for slot in range(start, end, duration):
     slotEnd = slot + duration

     // 가용 플레이어 필터
     available = pool.filter(p => p.availableFrom <= slot && p.availableUntil >= slotEnd)
     if available.length < 4: continue

     // 게임 수 오름차순 정렬 (공정 배분)
     available.sort((a, b) => gameCount[a.id] - gameCount[b.id])

     // 4인 선택: 균형 팀 구성 (강약 교차)
     [a, b, c, d] = available[0..3]
     Team1 = (a, d),  Team2 = (b, c)

     // 중복 대전 방지
     groupKey = sort([a,b,c,d].ids).join(',')
     if matchedGroups.has(groupKey): continue
     matchedGroups.add(groupKey)

     // 코트 자동 배치
     court = courtNumbers[courtIdx % courtNumbers.length]
     courtIdx++

     // INSERT club_match_results
     gameCount[a,b,c,d.id]++

3. batch INSERT → revalidatePath
```

---

## 권한 체크 매트릭스

| Action | 구현 위치 | 체크 방법 |
|--------|-----------|-----------|
| 세션 생성/수정/취소 | Server Action | `checkSessionOfficerAuth` (OWNER/ADMIN/MATCH_DIRECTOR) |
| 세션 삭제 | Server Action | 임원 + OPEN 상태만 |
| 참석 응답 | Server Action | 본인 club_member + OPEN + deadline 전 |
| 응답 취소 | Server Action | 본인 club_member |
| 게스트 추가/삭제 | Server Action | 임원 (OPEN/CLOSED 상태) |
| 대진 생성/수정/삭제 | Server Action | 임원 |
| 경기 결과 보고 | Server Action | 본인이 player1/2 + 게스트 없는 경기 + CLOSED + 시작 후 |
| 임원 결과 수정 | Server Action | 임원 |
| 분쟁 해결 | Server Action | 임원 |
| 모임 완료 처리 | Server Action | 임원 |
| 댓글 삭제 | Server Action | 본인 또는 임원 |

> 모든 mutation: admin client로 실행 + 서버 사이드 권한 체크 (RLS는 2차 방어선)

---

## 구현 완료 체크리스트 ✅

### DB 마이그레이션
- [x] `17_fix_club_member_role_enum.sql` 적용
- [x] `19_club_sessions.sql` 적용 (핵심 4개 테이블 + RLS)
- [x] `30_club_session_comments.sql` 적용 (댓글 테이블)

### 타입 정의
- [x] `ClubSession`, `ClubSessionDetail`, `SessionAttendanceDetail`
- [x] `ClubSessionGuest`, `SchedulePlayer`
- [x] `ClubMatchResult` (guest 필드 포함, nullable player 지원)
- [x] `ClubSessionComment`, `RankingPeriod`, `MatchType`
- [x] 모든 Server Action 입력 타입

### Server Actions (30+ 함수)
- [x] 세션 CRUD (생성/조회/수정/취소/삭제/상태변경)
- [x] 참석 응답 (upsert/취소/조회/마감)
- [x] 게스트 관리 (추가/삭제/조회)
- [x] 경기 결과 (수동/자동 생성, 보고, 분쟁 해결, 임원 수정, 삭제)
- [x] 통계/순위 (시즌별, 기간별, 내 통계, 멤버 결과)
- [x] 댓글 (조회/작성/삭제)

### 컴포넌트 (13개)
- [x] SessionForm, SessionCard, SessionList
- [x] SessionDatePicker, SessionTimePicker
- [x] AttendanceForm, AttendanceList
- [x] BracketEditor, MatchBoard, MatchResultForm
- [x] SessionCommentSection
- [x] RankingsTab, YearMonthPicker

### 페이지
- [x] 클럽 상세 탭 추가 (sessions, rankings)
- [x] 세션 상세 페이지
- [x] 세션 관리 페이지 (임원 전용)
