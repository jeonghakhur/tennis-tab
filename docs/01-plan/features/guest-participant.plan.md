# Plan: 클럽 모임 게스트 참석자 기능 (Guest Participant)

## 개요

클럽 관리자(임원)가 클럽 회원이 아닌 외부인을 특정 모임에 게스트로 등록할 수 있는 기능.
게스트는 회원과 동일하게 경기에 참가하고 대진에 포함되지만, 클럽 순위에는 집계되지 않는다.
게스트와 함께 경기한 회원의 성적은 정상 반영된다.

---

## 문제 정의

1. **회원이 아닌 지인과의 경기 불가**: 현재 모든 경기 참가자는 클럽 회원이어야 함
2. **체험/방문자 참여 지원 부재**: 클럽 가입 전 체험 참가자를 시스템에 포함할 방법 없음
3. **임시 참가자 수동 처리**: 게스트 참가 시 관리자가 별도로 관리하거나 기록에서 제외
4. **자동 대진 편성 배제**: 게스트를 고려하지 않는 자동 배정으로 공정성 저하

---

## 목표

1. **게스트 등록**: 임원이 특정 세션에 게스트(이름, 성별)를 등록
2. **대진 포함**: 게스트가 자동/수동 대진 편성에 포함됨
3. **경기 기록**: 게스트 포함 경기가 정상 기록되고 회원 통계에 반영
4. **권한 분리**: 게스트 점수는 임원만 입력 가능 (게스트 본인 입력 불가)
5. **순위 비포함**: 게스트는 클럽 순위표에 표시되지 않음

---

## 기능 범위

### Must Have

#### 게스트 관리
- [ ] `club_session_guests` 테이블 (session_id, name, gender, notes)
- [ ] 임원: 세션에 게스트 추가/삭제
- [ ] 게스트 목록을 참석자 현황 UI에 별도 섹션으로 표시

#### 경기 연동
- [ ] `club_match_results`에 guest_id 슬롯 4개 추가 (player1/2/1b/2b)
- [ ] 게스트 포함 경기 생성 (수동 대진 편성)
- [ ] 게스트 포함 경기 시 임원만 점수 입력 가능
- [ ] 경기 결과 표시 시 게스트 이름 정상 표시

#### 자동 대진
- [ ] `createAutoScheduleMatches()` 게스트 풀 포함
- [ ] 게스트는 세션 전체 시간 참가 가능으로 처리

#### 통계/순위
- [ ] 게스트 포함 경기에서 회원 통계 정상 갱신 (승/패 반영)
- [ ] 게스트는 순위표에 미표시
- [ ] 회원의 경기 기록 조회 시 게스트 상대 이름 표시

### Should Have

- [ ] 게스트 경기 여부를 경기 카드에 시각적으로 구분 (배지)
- [ ] 모임 완료 요약에 게스트 참가 수 표시

### Won't Have

- 게스트의 누적 통계 추적 (클럽 간 비교, 장기 기록)
- 게스트 본인이 점수 입력하는 기능
- 게스트 초대 링크/알림 발송

---

## 데이터 모델

### 신규: `club_session_guests`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK club_sessions |
| name | text NOT NULL | 게스트 이름 |
| gender | text | 'MALE' / 'FEMALE' / NULL |
| notes | text | 메모 (예: "홍길동 지인") |
| created_by | uuid | FK auth.users (등록 임원) |
| created_at | timestamptz | |

### 변경: `club_match_results` 컬럼 추가
| 컬럼 | 타입 | 설명 |
|------|------|------|
| player1_guest_id | uuid | FK club_session_guests (NULL 가능) |
| player2_guest_id | uuid | FK club_session_guests (NULL 가능) |
| player1b_guest_id | uuid | FK club_session_guests (NULL 가능) |
| player2b_guest_id | uuid | FK club_session_guests (NULL 가능) |

**슬롯 규칙**: 각 player 슬롯은 member_id OR guest_id 중 하나만 설정 (양쪽 동시 불가)

### `winner_member_id` 처리 규칙 변경
- 팀1 승리 시: `player1_member_id ?? player1b_member_id` (첫 번째 멤버)
- 팀2 승리 시: `player2_member_id ?? player2b_member_id`
- 게스트가 "캡틴 슬롯(player1/2)"을 차지할 경우 파트너 멤버를 winner로 기록

---

## 권한 모델

| 기능 | OWNER | ADMIN | MATCH_DIRECTOR | MEMBER |
|------|:-----:|:-----:|:--------------:|:------:|
| 게스트 추가/삭제 | ✅ | ✅ | ✅ | ❌ |
| 게스트 포함 경기 점수 입력 | ✅ | ✅ | ✅ | ❌ |
| 게스트 포함 경기 조회 | ✅ | ✅ | ✅ | ✅ |
| 게스트 포함 자동 대진 생성 | ✅ | ✅ | ✅ | ❌ |

---

## 기술 고려사항

### 자동 대진 (`createAutoScheduleMatches`) 변경
- 현재: `Member[]` (club_member_id 기반 풀)
- 변경: `SchedulePlayer[]` (member/guest 유니온 타입)
- 게스트는 `available_from = session.start_time`, `available_until = session.end_time` 로 처리
- 슬롯 배정 시 type에 따라 member_id 또는 guest_id 컬럼에 삽입

### 통계 갱신 (`updateStatsAfterMatch`) 변경
- guest_id 슬롯은 통계 갱신 대상에서 제외
- 멤버 슬롯만 `club_member_stats` 갱신

### 랭킹 조회 (`getClubRankingsByPeriod`) 변경
- winner 판정: `player1_member_id ?? player1b_member_id` 패턴으로 팀1 캡틴 멤버 특정
- NULL member_id 슬롯(=게스트) JOIN 시 LEFT JOIN으로 무시

### 점수 보고 권한 (`reportMatchResult`)
- 게스트 포함 경기(`player*_guest_id IS NOT NULL`) 감지 시 선수 모드 차단
- 임원(`adminOverrideMatchResult`)만 점수 입력 가능

---

## 화면 구성

### 참석자 현황 (AttendanceList)
```
참석 (N명)
  ├── [회원] 홍길동  오후 2시~5시
  └── [회원] 김철수  오후 1시~6시

게스트 (N명) [임원만 보임]
  ├── [게스트] 이방인 (남)  [삭제]
  └── [+ 게스트 추가]
```

### 경기 카드 (MatchBoard)
```
[게스트] 홍길동 / 이방인  vs  김철수 / 박영희
         3 : 2  [완료]
```

### 대진 편성 (BracketEditor)
```
선수 선택 드롭다운:
  ── 회원 ──
  ● 홍길동
  ● 김철수
  ── 게스트 ──
  ○ 이방인 (게스트)
```

---

## 연관 기능

| 기능 | 연관성 |
|------|--------|
| 참석 관리 (AttendanceList) | 게스트 섹션 추가 |
| 경기 관리 (MatchBoard) | 게스트 이름 표시, 점수 입력 권한 분리 |
| 자동 대진 | 게스트 풀 포함 |
| 순위/통계 | 게스트 제외, 회원 성적 정상 반영 |
| 경기 결과 조회 (MemberResultsClient) | 게스트 상대 이름 표시 |

---

## 구현 순서

1. **DB Migration 23**: `club_session_guests` 테이블 + `club_match_results` guest 컬럼
2. **Server Actions**: `addSessionGuest`, `removeSessionGuest`, `getSessionGuests`
3. **AttendanceList**: 게스트 섹션 + 추가/삭제 UI (임원 전용)
4. **통계/랭킹 로직**: `updateStatsAfterMatch` + `getClubRankingsByPeriod` winner 로직 수정
5. **MatchBoard / MatchResultForm**: 게스트 이름 표시 + 점수 입력 권한 처리
6. **BracketEditor**: 게스트 포함 선수 선택 드롭다운
7. **`createAutoScheduleMatches`**: 혼합 풀 지원 (가장 복잡)
8. **`getMemberGameResults`**: 게스트 상대 이름 표시

---

## 성공 지표

- 임원이 2분 이내 게스트 등록 완료
- 게스트 포함 자동 대진 생성 정상 동작
- 회원 통계에 게스트전 성적 반영 정확도 100%
- 순위표에 게스트 미노출
