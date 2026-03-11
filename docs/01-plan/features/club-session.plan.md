# Plan: 클럽 정기 모임 일정 관리 (Club Session)

> **구현 상태**: Phase 1 완료 ✅

## 개요

클럽 관리자가 정기 테니스 모임(코트 사용 일정)을 등록하면, 클럽 회원들이 참석 여부와 시간을 입력하고,
참석자 확정 후 관리자가 대진표를 작성하며, 각 회원이 직접 게임 결과를 등록할 수 있는 서비스.
누적 게임 데이터를 기반으로 개인 통계 및 클럽 내 순위를 제공한다.

---

## 문제 정의

1. **일정 관리 분산**: 클럽 모임 일정이 카카오톡/단체문자로만 공유 → 누락, 혼선 빈발
2. **참석 집계 비효율**: 출석 여부를 수동으로 수집 → 관리자 부담
3. **대진표 부재**: 모임 당일 즉흥적으로 경기 배정 → 공정성·기록 불가
4. **게임 데이터 미축적**: 경기 결과를 저장하지 않아 실력 추적·동기부여 어려움
5. **현 플랫폼 활용 기회**: 기존 bracket/match 인프라를 클럽 모임에도 재활용 가능

---

## 기능 범위

### Phase 1 — 완료 ✅

#### 세션 관리
- [x] `club_sessions` 테이블 (코트장, 코트번호 배열, 날짜, 시간, 최대인원, 메모, RSVP 마감)
- [x] 관리자: 세션 생성/수정(OPEN 상태만)/취소/삭제
- [x] 회원: 세션 목록 조회 (예정/완료 탭)
- [x] 세션 상태 전환: `OPEN → CLOSED → COMPLETED` / `CANCELLED`

#### 참석 응답
- [x] `club_session_attendances` 테이블 (member_id, ATTENDING/NOT_ATTENDING/UNDECIDED, 가용 시간대)
- [x] 회원: 참석/불참/미정 응답 + 시간 선택 (available_from/until)
- [x] 관리자: 참석자 명단 확인 (응답/미응답 상태 구분)
- [x] 마감 기능: `closeSessionRsvp()` → 이후 회원 응답 수정 불가

#### 게스트 관리 (플랜 대비 추가 구현)
- [x] `club_session_guests` 테이블 (이름, 성별, 가용 시간대)
- [x] 임원: 게스트 추가/삭제 (OPEN/CLOSED 상태만)
- [x] 대진표에서 회원 + 게스트 혼합 편성

#### 대진표
- [x] 임원: 확정 참석자 + 게스트 기반 대진 수동 생성
- [x] **자동 대진 생성** (`createAutoScheduleMatches`): 시간 슬롯 기반, 게임 수 공정 배분, 중복 대전 방지, 코트 자동 배치
- [x] 경기 타입: `singles` / `doubles` / `doubles_men` / `doubles_women` / `doubles_mixed`
- [x] 코트 번호 + 예정 시간 배정
- [x] `club_match_results` 별도 테이블 (bracket_matches와 분리)

#### 게임 결과 등록
- [x] 경기 참여 회원 양측이 점수 입력 가능 (게스트 경기 제외, CLOSED 상태 + 모임 시작 후)
- [x] **분쟁 처리**: 점수 불일치 시 `DISPUTED` → 임원 `resolveMatchDispute()`로 확정
- [x] 임원 직접 수정: `adminOverrideMatchResult()`
- [x] 결과 확정 후 통계 자동 반영

#### 통계 및 순위
- [x] `club_member_stats` 테이블 (시즌별 wins/losses/win_rate/sessions_attended, GENERATED 컬럼)
- [x] 클럽 내 순위표 (`getClubRankings`: win_rate 기반)
- [x] **기간별 순위** (`getClubRankingsByPeriod`): from/to 날짜 필터
- [x] 클럽 기본 순위 기간 설정 저장/조회
- [x] 내 통계 조회 (`getMyClubStats`)
- [x] 멤버 게임 결과 목록 (`getMemberGameResults`)
- [x] 모임 완료 시 `sessions_attended` 자동 갱신

### Should Have (Phase 2)

- [ ] 참석 시간대별 자동 매칭 (시간이 겹치는 사람끼리 우선 배정) — 현재 자동 대진 시 가용 시간 필터링으로 부분 구현
- [ ] 푸시/앱내 알림: 세션 생성, 응답 마감 임박, 대진표 공개
- [ ] 정기 세션 반복 생성 (매주 토요일 등)

### Won't Have (Phase 1)

- 결제/코트 예약 연동 (외부 시스템)
- 타 클럽과의 교류전 (별도 대회 기능 사용)
- 영상/사진 업로드

---

## 데이터 모델

### `club_sessions`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK clubs |
| title | text | 세션 제목 |
| venue_name | text | 코트장 이름 |
| court_numbers | text[] | 사용 코트 번호 배열 |
| session_date | date | 모임 날짜 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 (> start_time 제약) |
| max_attendees | int | 최대 참석 인원 |
| status | enum | OPEN / CLOSED / COMPLETED / CANCELLED |
| rsvp_deadline | timestamptz | 참석 응답 마감일시 |
| notes | text | 공지사항/메모 |
| created_by | uuid | FK profiles |
| created_at / updated_at | timestamptz | |

### `club_session_attendances`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| club_member_id | uuid | FK club_members |
| status | enum | ATTENDING / NOT_ATTENDING / UNDECIDED |
| available_from | time | 참석 가능 시작 시간 |
| available_until | time | 참석 가능 종료 시간 |
| notes | text | 회원 메모 |
| responded_at | timestamptz | |
| UNIQUE | — | (session_id, club_member_id) |

### `club_session_guests`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| name | text | 게스트 이름 |
| gender | text | 성별 |
| available_from | time | 가용 시작 시간 |
| available_until | time | 가용 종료 시간 |
| notes | text | 메모 |
| created_by | uuid | FK profiles |
| created_at | timestamptz | |

### `club_match_results`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| match_type | enum | singles / doubles / doubles_men / doubles_women / doubles_mixed |
| player1/2_member_id | uuid? | FK club_members (싱글스/복식 1번) |
| player1b/2b_member_id | uuid? | FK club_members (복식 파트너) |
| player1/2_guest_id | uuid? | FK club_session_guests |
| player1b/2b_guest_id | uuid? | FK club_session_guests |
| court_number | text | 배정 코트 |
| scheduled_time | time | 예정 시간 |
| player1_score / player2_score | int | 경기 점수 |
| winner_member_id | uuid? | FK club_members |
| status | enum | SCHEDULED / COMPLETED / DISPUTED / CANCELLED |
| player1/2_reported_score_p1/p2 | int? | 분쟁 시 각자 보고 점수 |
| dispute_resolved_by | uuid? | FK profiles |
| dispute_resolved_at | timestamptz? | |

### `club_member_stats`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK clubs |
| club_member_id | uuid | FK club_members |
| season | text | 시즌 (예: "2025") |
| total_games / wins / losses | int | 통계 |
| win_rate | numeric | GENERATED: `wins / total_games * 100` |
| sessions_attended | int | 참석 세션 수 |
| last_played_at | timestamptz | |
| UNIQUE | — | (club_id, club_member_id, season) |

**마이그레이션**: `supabase/migrations/19_club_sessions.sql`

---

## 아키텍처

### 디렉토리 구조

```
src/
├── app/clubs/[id]/
│   ├── page.tsx                          # 클럽 상세 (세션 목록 + 순위 탭)
│   └── sessions/[sessionId]/
│       ├── page.tsx                      # 모임 상세 (일반 멤버)
│       └── manage/page.tsx               # 모임 관리 (임원 전용)
│
├── lib/clubs/
│   ├── types.ts                          # 전체 타입 정의
│   ├── session-actions.ts                # 세션 Server Actions (~1900줄)
│   └── actions.ts                        # 클럽 관리 Server Actions
│
└── components/clubs/sessions/
    ├── SessionForm.tsx                   # 모임 생성/수정 모달
    ├── SessionList.tsx                   # 모임 목록
    ├── SessionCard.tsx                   # 모임 카드
    ├── SessionDatePicker.tsx             # 날짜 선택
    ├── SessionTimePicker.tsx             # 시간 선택
    ├── AttendanceForm.tsx                # 참석 응답
    ├── AttendanceList.tsx                # 참석자 목록 + 게스트 관리
    ├── BracketEditor.tsx                 # 대진표 수동/자동 편성
    ├── MatchBoard.tsx                    # 경기 결과 보드
    ├── MatchResultForm.tsx               # 점수 입력 / 분쟁 해결
    ├── RankingsTab.tsx                   # 순위표
    └── YearMonthPicker.tsx               # 년월 필터
```

### 데이터 흐름

```
[모임 생성] 임원 SessionForm
  └─ createClubSession() → INSERT club_sessions

[참석 응답] 멤버 AttendanceForm (OPEN 상태만)
  └─ respondToSession() → UPSERT club_session_attendances

[응답 마감] 임원
  └─ closeSessionRsvp() → UPDATE status = CLOSED

[대진 편성] 임원 BracketEditor (OPEN/CLOSED)
  ├─ 수동 → createMatchResult()
  └─ 자동 → createAutoScheduleMatches()
     └─ 시간 슬롯 순회 → 가용 플레이어 필터 → 게임 수 기반 공정 배분
        → 4인 복식 균형 팀(강약 교차) → 중복 대전 방지 → 코트 자동 배치

[경기 결과] MatchBoard (CLOSED + 모임 시작 후)
  ├─ 선수 reportMatchResult() → 양측 일치 시 COMPLETED 자동 확정
  ├─ 불일치 → DISPUTED → resolveMatchDispute() (임원)
  └─ 임원 adminOverrideMatchResult() (직접 수정)

[모임 완료] 임원
  └─ completeSession() → COMPLETED + sessions_attended++ + win_rate 갱신
```

---

## Server Actions (`session-actions.ts`)

### 세션 CRUD
| 함수 | 권한 | 설명 |
|------|------|------|
| `createClubSession(input)` | OWNER/ADMIN/MATCH_DIRECTOR | 생성 (sanitize + 시간 검증) |
| `getClubSessions(clubId, options)` | ACTIVE 멤버 | 목록 (status 필터, 페이징, attendance count) |
| `getClubSessionDetail(sessionId)` | ACTIVE 멤버 | 상세 (attendances + matches + guests JOIN) |
| `updateClubSession(sessionId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | OPEN 상태만 수정 |
| `cancelClubSession(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | → CANCELLED |
| `deleteClubSession(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | 삭제 |
| `changeSessionStatus(sessionId, status)` | OWNER/ADMIN/MATCH_DIRECTOR | 상태 직접 변경 |
| `getSessionPageData(sessionId, clubId)` | — | 상세 + 내 정보 동시 조회 (페이지 헬퍼) |

### 참석 응답
| 함수 | 권한 | 설명 |
|------|------|------|
| `respondToSession(input)` | ACTIVE 멤버 (본인) | 응답 (OPEN + rsvp_deadline 전) |
| `cancelAttendance(sessionId, memberId)` | ACTIVE 멤버 (본인) | 응답 취소 |
| `getSessionAttendances(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | 전체 응답 조회 |
| `closeSessionRsvp(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | OPEN → CLOSED |

### 게스트 관리
| 함수 | 권한 | 설명 |
|------|------|------|
| `getSessionGuests(sessionId)` | ACTIVE 멤버 | 게스트 목록 |
| `addSessionGuest(sessionId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | 게스트 추가 |
| `removeSessionGuest(guestId)` | OWNER/ADMIN/MATCH_DIRECTOR | 게스트 삭제 |

### 경기 결과
| 함수 | 권한 | 설명 |
|------|------|------|
| `createMatchResult(input)` | OWNER/ADMIN/MATCH_DIRECTOR | 대진 수동 생성 (중복 선수 체크) |
| `createAutoScheduleMatches(sessionId, duration)` | OWNER/ADMIN/MATCH_DIRECTOR | 자동 대진 생성 |
| `updateMatchResult(matchId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | 경기 정보 수정 |
| `deleteMatchResult(matchId)` | OWNER/ADMIN/MATCH_DIRECTOR | 삭제 (SCHEDULED만) |
| `deleteAllMatchResults(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | 세션 내 전체 삭제 |
| `getSessionMatches(sessionId)` | ACTIVE 멤버 | 경기 목록 |
| `reportMatchResult(matchId, input)` | 경기 참여 선수 | 결과 보고 |
| `resolveMatchDispute(matchId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | 분쟁 해결 |
| `adminOverrideMatchResult(matchId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | 점수 직접 수정 |

### 통계 / 순위
| 함수 | 권한 | 설명 |
|------|------|------|
| `completeSession(sessionId)` | OWNER/ADMIN/MATCH_DIRECTOR | CLOSED → COMPLETED + stats 갱신 |
| `getClubRankings(clubId, season)` | ACTIVE 멤버 | 시즌별 순위 |
| `getClubRankingsByPeriod(clubId, from, to)` | ACTIVE 멤버 | 기간별 순위 |
| `getClubDefaultRankingPeriod(clubId)` | — | 기본 순위 기간 조회 |
| `updateClubDefaultRankingPeriod(clubId, input)` | OWNER/ADMIN/MATCH_DIRECTOR | 기본 기간 저장 |
| `getMyClubStats(memberId, clubId, season)` | 본인 | 내 통계 |
| `getMemberGameResults(memberId, clubId)` | 본인 / 임원 | 멤버 게임 결과 |

---

## 권한 모델

| 기능 | OWNER | ADMIN | MATCH_DIRECTOR | MEMBER |
|------|:-----:|:-----:|:--------------:|:------:|
| 세션 생성/수정/취소/삭제 | ✅ | ✅ | ✅ | ❌ |
| 응답 마감 처리 | ✅ | ✅ | ✅ | ❌ |
| 게스트 추가/삭제 | ✅ | ✅ | ✅ | ❌ |
| 대진 편성 (수동/자동) | ✅ | ✅ | ✅ | ❌ |
| 경기 직접 수정 / 분쟁 해결 | ✅ | ✅ | ✅ | ❌ |
| 모임 완료 처리 | ✅ | ✅ | ✅ | ❌ |
| 참석 응답 | ✅ | ✅ | ✅ | ✅ |
| 경기 결과 보고 (본인 경기) | ✅ | ✅ | ✅ | ✅ |
| 세션/순위/통계 조회 | ✅ | ✅ | ✅ | ✅ |

**경기 결과 보고 조건** (일반 멤버):
- 게스트가 없는 경기
- 세션 상태 = `CLOSED` + 모임 시작 시간 이후
- 본인이 참여한 경기 (SCHEDULED 상태)

---

## 자동 대진 알고리즘 (`createAutoScheduleMatches`)

```
1. SchedulePlayer 풀 구성
   - 참석 멤버 (ATTENDING, available_from/until)
   - 게스트 (available_from/until)
   - 최소 4명 검증

2. 시간 슬롯 순회 (start → end, matchDuration 간격)
   ├─ 슬롯 내 가용 플레이어 필터 (available_from ≤ slot ≤ slotEnd)
   ├─ 게임 수 오름차순 정렬 (공정 배분)
   ├─ 4인 선택 후 균형 팀 구성: Team1 = (a,d) vs Team2 = (b,c)  [강약 교차]
   ├─ 중복 대전 방지 (matchedGroups Set)
   └─ 코트 자동 배치 (court_numbers 순환)

3. 결과: club_match_results batch INSERT
```

---

## 화면 구성

### 클럽 상세 탭: "모임"
```
/clubs/[id] → "모임" 탭
├── 예정된 세션 목록 (SessionCard)
│   ├── 날짜, 코트장, 시간, 응답 현황 (참석N/불참N/미응답N)
│   └── [참석 응답] 버튼 (미응답 시 강조)
└── 지난 세션 목록

/clubs/[id]/sessions/[sessionId]     # 일반 뷰
├── 모임 헤더 (제목, 상태 배지, 날짜/시간/장소/정원)
├── AttendanceForm (OPEN 상태 + 미응답/수정 모드)
├── AttendanceList (참석자 현황, 임원: 게스트 추가/삭제)
└── MatchBoard (CLOSED 이후 표시, 경기 결과 입력)

/clubs/[id]/sessions/[sessionId]/manage   # 임원 전용
├── 상태 변경 버튼 (응답 마감 / 모임 완료 / 취소)
├── AttendanceList (미응답 멤버 포함, 게스트 추가)
└── BracketEditor (수동/자동 대진 편성, 경기 삭제)
```

### 클럽 상세 탭: "순위"
```
/clubs/[id] → "순위" 탭
├── 기간 선택 (YearMonthPicker)
├── 순위표 (순위, 회원명, 게임수, 승/패, 승률, 참석 세션수)
└── 내 순위 강조 표시
```

---

## 기술 고려사항

### 기존 인프라 재활용
- `clubs` / `club_members` 테이블 기반 권한 체계 그대로 활용
- 기존 `ClubMemberRole` 타입과 `checkClubManagementAuth()` 패턴 적용
- `club_match_results`는 대회 `bracket_matches`와 별개 테이블 (클럽 내전용)

### 결과 등록 분쟁 처리
- 두 선수 모두 결과 입력 후 일치하면 `COMPLETED` 자동 확정
- 불일치 시 `DISPUTED` → 임원 `resolveMatchDispute()`로 확정
- 게스트가 포함된 경기는 임원만 결과 입력 (일반 회원 직접 입력 불가)

### 통계 갱신 전략
- 실시간 집계 대신 `club_member_stats`에 점진 갱신
- 경기 확정 시 `reportMatchResult()` / `resolveMatchDispute()` 내에서 stats upsert
- `win_rate`는 DB GENERATED ALWAYS 컬럼 (`wins / total_games * 100`)

### RLS 정책
- sessions/attendances/matches/stats: ACTIVE 멤버만 조회
- stats INSERT/UPDATE: admin client 전용 (Server Action 내부)
- 참석 응답 수정: 본인 응답 + OPEN 상태 + rsvp_deadline 전

---

## 연관 기능

| 기능 | 연관성 |
|------|--------|
| 클럽 회원 관리 | 참석자/대진 회원 목록 소스 |
| AI 채팅 | "이번 주 모임 언제야?", "나 몇 승이야?" 질의 지원 |
| 알림 (notifications) | Phase 2: 세션 생성/마감/대진 공개 알림 |
| 대회 대진표 (bracket) | 알고리즘 참고, 별도 테이블로 분리 운영 |

---

## 성공 지표

- 세션 응답률 > 80% (관리자 수동 집계 대비)
- 게임 결과 등록률 > 70% (경기 당일 기준)
- 관리자 세션 준비 시간 50% 감소
- 월 1회 이상 모임 진행 클럽에서 지속 사용

---

## Phase 2 로드맵

| 기능 | 설명 |
|------|------|
| 알림 연동 | 세션 생성/마감 임박/대진 공개 시 인앱 알림 |
| 정기 세션 반복 생성 | 매주 토요일 등 패턴 기반 자동 생성 |
| 싱글스 자동 대진 | 현재 복식만 지원, 싱글스 모드 추가 |
| 결과 이의 기간 설정 | 확정 후 N시간 이내 이의 가능 |
| 포인트 시스템 | win_rate 외 포인트 기반 랭킹 (현재 컬럼 존재, 미활용) |
