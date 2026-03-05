# Supabase 스키마 문서

> 네이티브 앱 개발 시 참고할 DB 스키마 및 RLS 정책 요약.
> 네이티브 앱은 웹과 동일한 Supabase 프로젝트/DB를 사용.

---

## Enums

```sql
user_role:         SUPER_ADMIN | ADMIN | MANAGER | USER | RESTRICTED
tournament_status: DRAFT | UPCOMING | OPEN | CLOSED | IN_PROGRESS | COMPLETED | CANCELLED
tournament_format: SINGLE_ELIMINATION | DOUBLE_ELIMINATION | LEAGUE | MIXED
match_type:        INDIVIDUAL_SINGLES | INDIVIDUAL_DOUBLES | TEAM_SINGLES | TEAM_DOUBLES
entry_status:      PENDING | APPROVED | REJECTED | CONFIRMED | WAITLISTED | CANCELLED
payment_status:    PENDING | COMPLETED | FAILED | CANCELLED
bracket_status:    DRAFT | PRELIMINARY | MAIN | COMPLETED
match_phase:       PRELIMINARY | ROUND_128 | ROUND_64 | ROUND_32 | ROUND_16 | QUARTER | SEMI | FINAL | THIRD_PLACE
match_status:      SCHEDULED | IN_PROGRESS | COMPLETED | BYE
club_join_type:    OPEN | APPROVAL | INVITE_ONLY
club_member_role:  OWNER | ADMIN | MEMBER | VICE_PRESIDENT | ADVISOR | MATCH_DIRECTOR
                   -- VICE_PRESIDENT, ADVISOR, MATCH_DIRECTOR: migration 18에서 추가
club_member_status:PENDING | INVITED | ACTIVE | LEFT | REMOVED
club_session_status: OPEN | CLOSED | CANCELLED | COMPLETED
attendance_status: ATTENDING | NOT_ATTENDING | UNDECIDED
match_result_status: SCHEDULED | COMPLETED | DISPUTED | CANCELLED
gender_type:       MALE | FEMALE  -- club_members.gender 용도 (migration 06)
```

---

## 테이블 구조

### 핵심 도메인

#### `profiles` — 사용자 프로필
```
id: UUID (FK → auth.users)
email, name, avatar_url, phone
start_year: TEXT ('2026', '2025년 이전' 등)
rating: INTEGER (1~9999)
gender: TEXT ('M' | 'F')
birth_year: TEXT
club, club_city, club_district
role: user_role (기본값: USER)
created_at, updated_at
```

**RLS:**
- SELECT: 모두 가능 (public)
- INSERT: 본인만 (`auth.uid() = id`)
- UPDATE: 본인만

---

#### `tournaments` — 대회
```
id, title, description
start_date, end_date, location, address
max_participants, entry_fee (INTEGER, 기본 0)
status: tournament_status
format: tournament_format
match_type: match_type
team_match_count: INTEGER (단체전 세트 수, migration 02)
host, organizer_name, ball_type
entry_start_date, entry_end_date, opening_ceremony
bank_account, eligibility, requirements: JSONB
poster_url
organizer_id: UUID (FK → profiles)
```

**RLS:**
- SELECT: 모두
- INSERT: authenticated 사용자
- UPDATE: organizer_id = me OR ADMIN 이상

---

#### `tournament_divisions` — 대회 부서
```
id, tournament_id: UUID (FK → tournaments)
name, max_teams, team_member_limit
match_date, match_location
prize_winner, prize_runner_up, prize_third, notes (HTML)
```

**RLS:**
- SELECT: 모두
- INSERT/UPDATE/DELETE: tournament organizer OR ADMIN 이상

---

#### `tournament_entries` — 참가 신청
```
id, tournament_id, user_id, division_id
status: entry_status (기본: PENDING)
phone, player_name, player_rating, club_name
team_order: TEXT (단체전: 가/나/다)
partner_data: JSONB (복식 파트너 정보)
  { name: string, club: string, rating: number }
team_members: JSONB (단체전 팀원 배열)
  [{ name: string, rating: number, club?: string }]
payment_status: payment_status
payment_confirmed_at
payment_key: TEXT (TossPayments 결제 키, migration 12)
toss_order_id: TEXT (TossPayments 주문 ID, migration 12)
```

**RLS:**
- SELECT: 모두
- INSERT/UPDATE/DELETE: 본인 (user_id = me) OR tournament organizer

---

### 대진표 시스템

#### `bracket_configs` — 대진표 설정
```
id, division_id: UUID (FK → tournament_divisions, UNIQUE)
has_preliminaries: BOOLEAN
third_place_match: BOOLEAN
bracket_size: INTEGER (4/8/16/32/64/128)
group_size: INTEGER (조별 팀수: 2 or 3, migration 04)
status: bracket_status
active_phase: TEXT NULL (현재 활성 페이즈, NULL=비활성, migration 26)
active_round: INT NULL (현재 활성 라운드 번호, NULL=해당 페이즈 전체, migration 26)
```

#### `preliminary_groups` — 예선 조
```
id, bracket_config_id
name: VARCHAR(10) ('A', 'B', 'C'...)
display_order: INTEGER
```

#### `group_teams` — 조별 팀 배정
```
id, group_id, entry_id
seed_number: INTEGER
final_rank: INTEGER (예선 결과 순위)
wins, losses: INTEGER
points_for, points_against: INTEGER
```

#### `bracket_matches` — 본선/예선 경기
```
id
bracket_config_id: UUID (FK → bracket_configs)  -- 주의: config_id 아님
phase: match_phase
round_number: INTEGER                            -- 주의: round 아님
bracket_position: INTEGER (본선 대진표 내 위치)
match_number: INTEGER
group_id: UUID (FK → preliminary_groups, 예선 조 경기 시)
team1_entry_id, team2_entry_id: UUID (FK → tournament_entries)  -- 주의: entry1_id/entry2_id 아님
winner_entry_id: UUID
team1_score, team2_score: INTEGER (팀 세트 스코어)  -- 주의: score1/score2 아님
sets_detail: JSONB (단체전 세트별 상세)
  [{ set_number, team1_players[], team2_players[], team1_score, team2_score }]
status: match_status  -- BYE는 status='BYE'로 처리 (is_bye 컬럼 없음)
next_match_id: UUID (승자 이동 경기)
next_match_slot: INTEGER (1 or 2)
loser_next_match_id: UUID (패자전)
loser_next_match_slot: INTEGER (1 or 2)
court_number: TEXT
court_location: TEXT
scheduled_time: TIMESTAMPTZ
completed_at: TIMESTAMPTZ
notes: TEXT
```

---

### 클럽 시스템

#### `clubs` — 클럽
```
id, name, representative_name, description
city, district, address
contact_phone, contact_email
join_type: club_join_type
association_id: UUID (FK → associations, nullable)
max_members, is_active
created_by
default_ranking_period: TEXT (랭킹 집계 기간 설정, migration 22)
default_ranking_from: TEXT (랭킹 집계 시작일, migration 22)
default_ranking_to: TEXT (랭킹 집계 종료일, migration 22)
```

#### `club_members` — 클럽 회원
```
id, club_id
user_id: UUID (FK → profiles, nullable — 미등록 회원은 NULL)
is_registered: BOOLEAN DEFAULT false (앱 계정 연동 여부)

-- 프로필 데이터를 직접 보유 (profiles JOIN 불필요)
-- 이유: user_id=NULL인 미등록 회원도 지원해야 하므로
name: TEXT NOT NULL
birth_date: TEXT
gender: gender_type (MALE | FEMALE)
phone: TEXT
start_year: TEXT
rating: NUMERIC

role: club_member_role
status: club_member_status
status_reason: TEXT
invited_by: UUID
joined_at
```

#### `club_sessions` — 정기 모임
```
id, club_id, title
venue_name, court_numbers: TEXT[]
session_date: DATE, start_time, end_time: TIME
max_attendees: INT
status: club_session_status
rsvp_deadline: TIMESTAMPTZ
notes: TEXT
created_by
```

#### `club_session_attendances` — 참석 응답
```
id, session_id
club_member_id: UUID (FK → club_members)  -- 주의: member_id 아님
status: attendance_status
available_from: TIME (참석 가능 시작 시각)
available_until: TIME (참석 가능 종료 시각)
notes: TEXT
responded_at
```

#### `club_session_guests` — 게스트 참가자
```
id, session_id, name, gender
notes: TEXT
available_from: TIME (참석 가능 시작 시각, migration 24)
available_until: TIME (참석 가능 종료 시각, migration 24)
created_by
```

#### `club_match_results` — 경기 결과
```
id, session_id
player1_member_id, player2_member_id (FK → club_members)
player1b_member_id, player2b_member_id (복식 파트너)
match_type: TEXT ('singles'/'doubles_men'/'doubles_women'/'doubles_mixed'/'doubles')
            -- 'doubles' 값: migration 21에서 추가
player1_score, player2_score: INTEGER  -- 주의: score1/score2 아님
winner_member_id (FK → club_members)
status: match_result_status
player1_guest_id, player2_guest_id (FK → club_session_guests)
player1b_guest_id, player2b_guest_id (FK → club_session_guests, 복식 게스트 파트너)
court_number: TEXT
scheduled_time: TIME
-- 점수 분쟁 관련 컬럼
player1_reported_score_1, player1_reported_score_2: INTEGER
player2_reported_score_1, player2_reported_score_2: INTEGER
dispute_resolved_by: UUID
dispute_resolved_at: TIMESTAMPTZ
dispute_notes: TEXT
reported_by: UUID
notes
```

#### `club_member_stats` — 회원 통계 (집계 캐시)
```
id, club_id
club_member_id: UUID (UNIQUE per club + season)  -- 주의: member_id 아님
season: TEXT (UNIQUE 제약: club_id + club_member_id + season)
total_games: INTEGER  -- 주의: total_matches 아님
wins, losses: INTEGER
-- draws 컬럼 없음
win_rate: DECIMAL
sessions_attended: INT
last_played_at: TIMESTAMPTZ
updated_at  -- 주의: last_updated 아님
```

---

### 협회 시스템

#### `associations` — 테니스 협회
```
id, name (UNIQUE), region, district, description
president_name/phone/email, secretary_name/phone/email
created_by, is_active
```

#### `association_managers` — 협회 매니저
```
id
association_id: UUID (FK → associations)
user_id: UUID (FK → profiles)
assigned_by: UUID (FK → profiles)
assigned_at
UNIQUE(association_id, user_id)
```

---

### 기타 테이블

#### `matches` — 레거시 경기 테이블 (migration 00)
```
-- 초기 스키마에 생성된 레거시 테이블. 현재 대진표 시스템은 bracket_matches 사용.
-- 네이티브 앱에서는 사용하지 않음.
```

#### `chat_logs` — 챗봇 대화 로그 (migration 00)
```
-- NLP 챗봇 시스템 로그. 네이티브 앱 포함 여부 별도 검토 필요.
-- src/lib/chat/ 참조.
```

#### `posts` — 커뮤니티 게시글
```
id, title, content (HTML), author_id (FK → profiles)
like_count: INTEGER
created_at, updated_at
```

#### `post_likes` — 좋아요
```
id, post_id, user_id
UNIQUE(post_id, user_id)
```

#### `tournament_awards` — 수상 이력
```
id
competition: TEXT (대회명)
year: SMALLINT
division: TEXT (부서명)
game_type: TEXT ('단체전'/'개인전')
award_rank: TEXT ('우승'/'준우승'/'공동3위'/'3위')
players: TEXT[] (선수 이름 배열)
club_name: TEXT
-- 미래 대회 연결 (레거시는 NULL)
tournament_id, division_id, entry_id (모두 nullable)
-- 유저 클레임
player_user_ids: UUID[]
club_id (FK → clubs, nullable)
legacy_id: TEXT UNIQUE (중복 방지)
display_order: INT
```

---

## 주요 RLS 패턴

### 모바일 클라이언트 권한 플로우

```
[비로그인 (anon)]
  ✅ 조회: tournaments, profiles, clubs, tournament_awards, posts
  ❌ 쓰기: 모두 불가

[로그인 (authenticated)]
  ✅ tournament_entries INSERT (본인)
  ✅ tournament_entries UPDATE/DELETE (본인)
  ✅ club_sessions 조회 (해당 클럽 멤버)
  ✅ club_session_attendances (본인)
  ✅ post_likes (본인)
  ❌ bracket_matches 수정 (MANAGER 이상만, migration 13에서 변경)

[MANAGER 이상]
  ✅ posts INSERT/UPDATE/DELETE
  ✅ tournament_entries 상태 업데이트

[MANAGER 이상]
  ✅ bracket_matches 관리 (migration 13에서 ADMIN+ → MANAGER+로 변경)
  ✅ tournament_divisions 관리

[SUPER_ADMIN]
  ✅ 모든 권한 + 역할 변경
```

> ⚠️ Service Role Key (어드민 클라이언트)는 RLS 우회 — 네이티브 앱에서는 절대 사용 금지.
> 네이티브 앱은 항상 anon key + 사용자 세션으로만 접근.

---

## Realtime 구독 테이블

| 테이블 | 활성화 마이그레이션 | 사용 화면 |
|--------|-------------------|---------|
| `bracket_matches` | `05_enable_realtime_bracket_matches.sql` | 대진표 보기 |
| `club_members` | `09_enable_realtime_club_members.sql` | 클럽 상세 |
| `tournaments` | `25_enable_realtime_tournaments.sql` | 대회 목록, 마이페이지 |
| `bracket_configs` | `26_bracket_active_round.sql` | 대진표 보기 (active_phase/active_round 실시간 전파) |

**설정 필수 사항:**
```sql
ALTER TABLE bracket_matches REPLICA IDENTITY FULL;
ALTER TABLE bracket_configs REPLICA IDENTITY FULL;
-- UPDATE 이벤트에서 old/new 전체 row 전송을 위해 필요
```
