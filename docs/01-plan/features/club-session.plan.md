# Plan: 클럽 정기 모임 일정 관리 (Club Session)

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

## 목표

1. **클럽 세션 등록**: 관리자가 코트장/코트번호/날짜/시간을 입력
2. **참석 응답 시스템**: 회원이 참석 여부 + 참석 시작~종료 시간 입력
3. **대진표 생성**: 참석 확정된 회원 기반으로 관리자가 대진 편성
4. **게임 결과 셀프 등록**: 회원이 자신의 경기 결과 직접 입력
5. **통계 및 순위**: 클럽 내 승률, 게임 수, 포인트 기반 순위

---

## 기능 범위

### Must Have (Phase 1 — MVP)

#### 세션 관리
- [ ] `club_sessions` 테이블 (코트장, 코트번호, 날짜, 시간, 최대인원, 메모)
- [ ] 관리자: 세션 생성/수정/취소
- [ ] 회원: 세션 목록 조회 (예정/완료 탭)

#### 참석 응답
- [ ] `club_session_attendances` 테이블 (member_id, 참석여부, 시작시간, 종료시간)
- [ ] 회원: 참석/불참 응답 + 시간 선택
- [ ] 관리자: 참석자 명단 확인 (응답/미응답 상태 구분)
- [ ] 마감 기능: 관리자가 응답 마감 → 이후 수정 불가

#### 대진표
- [ ] 관리자: 확정 참석자 기반으로 라운드로빈/풀리그/단판 대진 생성
- [ ] 기존 `bracket_matches` 스키마 확장 or 별도 `club_match_results` 테이블
- [ ] 코트 번호 + 시간 슬롯 배정

#### 게임 결과 등록
- [ ] 경기 참여 회원 양측이 점수 입력 가능
- [ ] 점수 불일치 시 관리자 중재 플로우
- [ ] 결과 확정 후 통계 자동 반영

### Should Have (Phase 2)

- [ ] 참석 시간대별 자동 매칭 (시간이 겹치는 사람끼리 우선 배정)
- [ ] 푸시/앱내 알림: 세션 생성, 응답 마감 임박, 대진표 공개
- [ ] 정기 세션 반복 생성 (매주 토요일 등)

### Won't Have (Phase 1)

- 결제/코트 예약 연동 (외부 시스템)
- 타 클럽과의 교류전 (별도 대회 기능 사용)
- 영상/사진 업로드

---

## 데이터 모델 (초안)

### `club_sessions`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK clubs |
| title | text | 세션 제목 (예: "2025년 3월 정기 모임") |
| venue_name | text | 코트장 이름 |
| court_numbers | text[] | 사용 코트 번호 배열 (예: ["1번", "2번"]) |
| session_date | date | 모임 날짜 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |
| max_attendees | int | 최대 참석 인원 |
| status | enum | OPEN / CLOSED / CANCELLED / COMPLETED |
| rsvp_deadline | timestamptz | 참석 응답 마감일시 |
| notes | text | 공지사항/메모 |
| created_by | uuid | FK profiles (관리자) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `club_session_attendances`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| club_member_id | uuid | FK club_members |
| status | enum | ATTENDING / NOT_ATTENDING / UNDECIDED |
| available_from | time | 참석 가능 시작 시간 |
| available_until | time | 참석 가능 종료 시간 |
| notes | text | 회원 메모 (예: "오후만 가능") |
| responded_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `club_match_results` (or 기존 bracket_matches 확장)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| player1_member_id | uuid | FK club_members |
| player2_member_id | uuid | FK club_members |
| court_number | text | 배정 코트 번호 |
| scheduled_time | time | 예정 시간 |
| player1_score | int | 1번 선수 점수 |
| player2_score | int | 2번 선수 점수 |
| winner_member_id | uuid | FK club_members |
| status | enum | SCHEDULED / IN_PROGRESS / COMPLETED / DISPUTED |
| reported_by | uuid | FK profiles (결과 등록자) |
| confirmed_at | timestamptz | 결과 확정 일시 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `club_member_stats` (통계 집계 테이블, 점진 갱신)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK clubs |
| club_member_id | uuid | FK club_members |
| season | text | 시즌 (예: "2025", "2025-Q1") |
| total_games | int | 총 게임 수 |
| wins | int | 승 |
| losses | int | 패 |
| win_rate | numeric | 승률 |
| points | int | 포인트 (랭킹 산정용) |
| sessions_attended | int | 참석 세션 수 |
| last_played_at | timestamptz | 마지막 경기일 |
| updated_at | timestamptz | |

---

## 화면 구성

### 클럽 상세 페이지 신규 탭: "모임"
```
/clubs/[id] → "모임" 탭
├── 예정된 세션 목록 (카드형)
│   ├── 날짜, 코트장, 시간, 응답 현황 (O명/X명/미응답N명)
│   └── [참석 응답] 버튼 (미응답 시 강조)
└── 지난 세션 목록 (접힘)

/clubs/[id]/sessions/[sessionId]
├── 세션 상세 (코트장, 코트번호, 시간, 메모)
├── 참석 응답 폼 (참석/불참, 시간 선택)
├── 참석자 현황 (참석 N명, 불참 N명, 미응답 N명)
├── 대진표 (확정 후 공개)
└── 경기 결과 목록 + 내 경기 결과 입력

/clubs/[id]/sessions/[sessionId]/manage (관리자 전용)
├── 참석자 상세 목록
├── 응답 마감 버튼
├── 대진 편성 UI
└── 대진표 공개 버튼
```

### 클럽 상세 신규 탭: "순위"
```
/clubs/[id] → "순위" 탭
├── 시즌 선택
├── 순위표 (순위, 회원명, 게임수, 승/패, 승률, 포인트)
└── 내 순위 강조 표시
```

---

## 권한 모델

| 기능 | OWNER | ADMIN | MATCH_DIRECTOR | MEMBER |
|------|:-----:|:-----:|:--------------:|:------:|
| 세션 생성/수정/취소 | ✅ | ✅ | ✅ | ❌ |
| 응답 마감 처리 | ✅ | ✅ | ✅ | ❌ |
| 대진 편성 | ✅ | ✅ | ✅ | ❌ |
| 결과 분쟁 해결 | ✅ | ✅ | ✅ | ❌ |
| 참석 응답 | ✅ | ✅ | ✅ | ✅ |
| 경기 결과 등록 | ✅ | ✅ | ✅ | ✅ |
| 세션/순위 조회 | ✅ | ✅ | ✅ | ✅ |

---

## 기술 고려사항

### 기존 인프라 재활용
- `clubs` / `club_members` 테이블 기반 권한 체계 그대로 활용
- 기존 `ClubMemberRole` 타입과 `checkClubManagementAuth()` 패턴 적용
- 대진 생성 알고리즘은 `src/lib/bracket/` 로직 참고

### 결과 등록 분쟁 처리
- 두 선수 모두 결과 입력 후 일치하면 자동 확정
- 불일치 시 `DISPUTED` 상태 → 관리자 확정 필요
- 악용 방지: 본인 경기 결과만 입력 가능 (상대방 확인 절차)

### 통계 갱신 전략
- 실시간 집계 대신 `club_member_stats` 테이블에 점진 갱신
- 경기 확정 시 Supabase Function 또는 Server Action에서 stats 업데이트

### RLS 정책
- 세션 조회: 클럽 멤버만 가능 (`club_members.status = 'ACTIVE'`)
- 세션 생성/수정: `OWNER/ADMIN/MATCH_DIRECTOR` 역할 확인
- 참석 응답 수정: 본인 응답만 수정 가능 + 마감 전
- 결과 등록: 경기에 참여한 두 선수만 가능

---

## 연관 기능

| 기능 | 연관성 |
|------|--------|
| 클럽 회원 관리 | 참석자/대진 회원 목록 소스 |
| AI 채팅 | "이번 주 모임 언제야?", "나 몇 승이야?" 질의 지원 |
| 알림 (notifications) | 세션 생성/마감/대진공개 푸시 |
| 순위/통계 (tournament_awards) | 대외 대회 실적과 클럽 내 실적 분리 관리 |

---

## 구현 우선순위 (Phase 1)

1. **DB 마이그레이션**: 신규 테이블 4개 + RLS 정책
2. **Server Actions**: CRUD (sessions, attendances, match_results, stats)
3. **세션 목록 + 상세 UI**: 클럽 탭에 통합
4. **참석 응답 UI**: 모바일 친화적 빠른 응답 폼
5. **대진 편성 UI**: 관리자 드래그 배정 or 자동 생성
6. **결과 등록 + 분쟁 처리 UI**
7. **순위표 탭**

---

## 성공 지표

- 세션 응답률 > 80% (관리자 수동 집계 대비)
- 게임 결과 등록률 > 70% (경기 당일 기준)
- 관리자 세션 준비 시간 50% 감소
- 월 1회 이상 모임 진행 클럽에서 지속 사용
