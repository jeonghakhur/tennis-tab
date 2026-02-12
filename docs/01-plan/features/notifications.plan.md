# Plan: 알림(Notifications) 시스템

## 1. 개요

### 배경
현재 Tennis Tab은 Toast(3초 자동 소멸)와 Supabase Realtime(대진표/대회 상태 실시간 UI 갱신)만 존재한다. 사용자가 로그아웃 후 놓친 이벤트를 확인할 방법이 없고, 참가 승인/거절, 경기 일정 확정 등 중요 이벤트에 대한 영구 기록이 없다.

### 목표
- **인앱 알림 센터**: 읽음/안읽음 관리가 되는 영구 알림 목록
- **실시간 알림 배지**: Navigation에 미읽음 카운트 표시 + 실시간 갱신
- **알림 자동 생성**: 기존 Server Actions의 주요 이벤트에서 알림 자동 생성
- **알림 설정**: 사용자별 알림 수신 여부 설정 (Phase 2)

### 범위 (Phase 1 — MVP)
| 포함 | 제외 (Phase 2+) |
|------|----------------|
| `notifications` 테이블 + RLS | 이메일/SMS 알림 |
| Supabase Realtime 실시간 알림 | Web Push (Service Worker) |
| Navigation + AdminHeader 알림 벨 아이콘 + 미읽음 배지 | 알림 설정 페이지 (타입별 on/off) |
| `/my/notifications` 알림 목록 페이지 | 대량 알림 배치 처리 (Cron) |
| 알림 읽음/전체 읽음 처리 | 알림 만료 자동 삭제 |
| 10가지 알림 타입 — 사용자 6 + 관리자 4 (아래 참조) | — |

---

## 2. 알림 타입 (Phase 1)

### 2.1 사용자 알림

| Type | 트리거 시점 | 대상 | 우선순위 |
|------|-----------|------|---------|
| `ENTRY_APPROVED` | 관리자가 참가 신청 승인 | 참가자 | 높음 |
| `ENTRY_REJECTED` | 관리자가 참가 신청 거절 | 참가자 | 높음 |
| `TOURNAMENT_STATUS_CHANGED` | 대회 상태 변경 (OPEN, CLOSED, IN_PROGRESS 등) | 해당 대회 참가자 전원 | 중간 |
| `BRACKET_GENERATED` | 대진표 생성 완료 | 해당 부서 참가자 전원 | 중간 |
| `MATCH_RESULT_UPDATED` | 내 경기 결과 확정 | 해당 경기 참가자 | 중간 |
| `CLUB_MEMBER_APPROVED` | 클럽 가입 승인 | 가입 신청자 | 높음 |
| `CLUB_MEMBER_REJECTED` | 클럽 가입 거절 | 가입 신청자 | 높음 |
| `SYSTEM_ANNOUNCEMENT` | 관리자 수동 공지 | 지정 대상 or 전체 | 낮음 |

### 2.2 관리자(주최자/클럽운영자) 알림

| Type | 트리거 시점 | 대상 | 우선순위 |
|------|-----------|------|---------|
| `ENTRY_SUBMITTED` | 참가자가 신청 접수 | 대회 주최자 (`organizer_id`) | 높음 |
| `ENTRY_CANCELLED` | 참가자가 신청 취소 | 대회 주최자 | 중간 |
| `PAYMENT_COMPLETED` | 참가자 결제 확인 완료 | 대회 주최자 | 높음 |
| `CLUB_JOIN_REQUESTED` | 클럽 가입 신청 (APPROVAL 모드, status=PENDING) | 클럽 OWNER/ADMIN | 높음 |

---

## 3. 데이터 모델

### 3.1 `notifications` 테이블

```sql
CREATE TYPE notification_type AS ENUM (
  -- 사용자 알림
  'ENTRY_APPROVED',
  'ENTRY_REJECTED',
  'TOURNAMENT_STATUS_CHANGED',
  'BRACKET_GENERATED',
  'MATCH_RESULT_UPDATED',
  'CLUB_MEMBER_APPROVED',
  'CLUB_MEMBER_REJECTED',
  'SYSTEM_ANNOUNCEMENT',
  -- 관리자(주최자/클럽운영자) 알림
  'ENTRY_SUBMITTED',
  'ENTRY_CANCELLED',
  'PAYMENT_COMPLETED',
  'CLUB_JOIN_REQUESTED'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- 관련 엔티티 (nullable, 타입에 따라 다름)
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES tournament_entries(id) ON DELETE SET NULL,
  match_id UUID REFERENCES bracket_matches(id) ON DELETE SET NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,

  -- 추가 데이터 (링크 URL, 부서명 등)
  metadata JSONB DEFAULT '{}',

  -- 상태
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 미읽음 최신순 조회 최적화
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자/시스템만 INSERT (Service Role Key 사용)
-- RLS INSERT 정책 없음 → admin client로만 삽입
```

### 3.2 metadata 활용 예시

```jsonc
// ── 사용자 알림 ──

// ENTRY_APPROVED
{ "division_name": "남자 A조", "link": "/tournaments/{id}" }

// TOURNAMENT_STATUS_CHANGED
{ "old_status": "OPEN", "new_status": "CLOSED", "link": "/tournaments/{id}" }

// BRACKET_GENERATED
{ "division_name": "남자 A조", "link": "/tournaments/{id}/bracket" }

// MATCH_RESULT_UPDATED
{ "opponent_name": "홍길동", "score": "6:4", "result": "WIN", "link": "/tournaments/{id}/bracket" }

// ── 관리자 알림 ──

// ENTRY_SUBMITTED
{ "player_name": "김철수", "division_name": "남자 A조", "link": "/admin/tournaments/{id}/entries" }

// ENTRY_CANCELLED
{ "player_name": "김철수", "division_name": "남자 A조", "link": "/admin/tournaments/{id}/entries" }

// PAYMENT_COMPLETED
{ "player_name": "김철수", "amount": 30000, "link": "/admin/tournaments/{id}/entries" }

// CLUB_JOIN_REQUESTED
{ "applicant_name": "이영희", "link": "/admin/clubs/{club_id}" }

// CLUB_MEMBER_APPROVED
{ "club_name": "마포테니스클럽", "link": "/clubs/{club_id}" }

// CLUB_MEMBER_REJECTED
{ "club_name": "마포테니스클럽" }
```

---

## 4. 아키텍처

### 4.1 디렉토리 구조

```
src/
├── lib/
│   └── notifications/
│       ├── actions.ts       # Server Actions (CRUD + 알림 생성)
│       └── types.ts         # NotificationType, Notification 타입
├── lib/
│   └── realtime/
│       └── useNotifications.ts  # Realtime 훅 (미읽음 카운트)
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx  # Navigation 알림 벨 아이콘
│       └── NotificationList.tsx  # 알림 목록 (클라이언트 컴포넌트)
└── app/
    └── my/
        └── notifications/
            └── page.tsx         # 알림 페이지 (서버 컴포넌트)
```

### 4.2 데이터 흐름

```
[Server Action 이벤트 발생]
  ↓
createNotification() — admin client로 INSERT
  ↓
[Supabase Realtime postgres_changes]
  ↓
useNotifications hook — INSERT 감지 → unreadCount++
  ↓
[NotificationBell UI 갱신] — 빨간 배지 숫자 증가
  ↓
[사용자 클릭 → /my/notifications]
  ↓
markAsRead() / markAllAsRead() — UPDATE is_read=true
  ↓
[Realtime UPDATE 감지] → unreadCount--
```

### 4.3 알림 생성 통합 지점

#### 사용자(참가자) 알림
| Server Action 파일 | 함수 | 알림 타입 |
|---|---|---|
| `src/lib/entries/actions.ts` | `updateEntryStatus()` | `ENTRY_APPROVED`, `ENTRY_REJECTED` |
| `src/lib/tournaments/actions.ts` | `updateTournament()` (status 변경 시) | `TOURNAMENT_STATUS_CHANGED` |
| `src/lib/bracket/actions.ts` | `generateMainBracket()` | `BRACKET_GENERATED` |
| `src/lib/bracket/actions.ts` | `updateMatchScore()` (COMPLETED 시) | `MATCH_RESULT_UPDATED` |

#### 관리자(주최자) 알림

> **참고**: 대회 주최자(`organizer_id`) = 협회 매니저이므로 별도 `association_managers` 조회 불필요.
> SUPER_ADMIN 전체 수신은 Phase 2 알림 설정(notification_preferences)에서 opt-in으로 처리.

| Server Action 파일 | 함수 | 알림 타입 | 대상 결정 |
|---|---|---|---|
| `src/lib/entries/actions.ts` | `createEntry()` | `ENTRY_SUBMITTED` | `tournaments.organizer_id` |
| `src/lib/entries/actions.ts` | 참가 취소 (DELETE/UPDATE) | `ENTRY_CANCELLED` | `tournaments.organizer_id` |
| `src/lib/entries/actions.ts` | 결제 확인 처리 | `PAYMENT_COMPLETED` | `tournaments.organizer_id` |
| `src/lib/clubs/actions.ts` | `joinClubAsRegistered()` (status=PENDING) | `CLUB_JOIN_REQUESTED` | 클럽 OWNER/ADMIN (`club_members` role 기반) |
| `src/lib/clubs/actions.ts` | `reviewMembership()` (승인) | `CLUB_MEMBER_APPROVED` | 가입 신청자 (`club_members.user_id`) |
| `src/lib/clubs/actions.ts` | `reviewMembership()` (거절) | `CLUB_MEMBER_REJECTED` | 가입 신청자 |

---

## 5. 핵심 구현 계획

### 5.1 Server Actions (`src/lib/notifications/actions.ts`)

```typescript
// 알림 조회 (본인 것만, RLS 적용)
getNotifications(options?: { limit, offset, unreadOnly })

// 알림 읽음 처리
markAsRead(notificationId: string)
markAllAsRead()

// 미읽음 수 조회
getUnreadCount(): Promise<number>

// 알림 생성 (내부 전용, admin client 사용)
// 직접 export하지 않고 다른 actions에서 import하여 사용
createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  tournamentId?: string
  entryId?: string
  matchId?: string
  metadata?: Record<string, unknown>
})

// 다수 사용자에게 일괄 알림 (대회 상태 변경, 대진표 생성)
createBulkNotifications(params: {
  userIds: string[]
  type: NotificationType
  title: string
  message: string
  tournamentId?: string
  metadata?: Record<string, unknown>
})
```

### 5.2 Realtime Hook (`src/lib/realtime/useNotifications.ts`)

```typescript
interface UseNotificationsReturn {
  unreadCount: number
  // 새 알림 도착 시 콜백 (Toast 표시 등)
  latestNotification: Notification | null
}

function useNotifications(userId: string | undefined): UseNotificationsReturn
```

- `notifications` 테이블에 `user_id=eq.{userId}` 필터로 구독
- INSERT → `unreadCount++` + `latestNotification` 업데이트
- UPDATE (is_read=true) → `unreadCount--`
- 기존 `useMatchesRealtime` 패턴과 동일하게 ref 기반 상태 관리

### 5.3 UI 컴포넌트

#### NotificationBell (Navigation 통합)
- `Navigation.tsx`에 로그인 사용자일 때 벨 아이콘 추가
- `useNotifications` hook으로 미읽음 카운트 실시간 표시
- 클릭 시 `/my/notifications`로 이동
- 미읽음 0이면 배지 숨김, 9 초과 시 `9+` 표시

#### NotificationList (알림 목록 페이지)
- 알림 카드: 아이콘(타입별) + 제목 + 메시지 + 시간 + 읽음 상태
- "모두 읽음" 버튼
- 무한 스크롤 또는 페이지네이션 (초기: 20개 limit)
- 빈 상태: "새로운 알림이 없습니다"
- 알림 클릭 시 `metadata.link`로 이동 + 자동 읽음 처리

### 5.4 AdminHeader 통합 (관리자 페이지)
- `AdminHeader.tsx`에도 동일한 NotificationBell 배치
- 관리자는 참가 신청/취소/결제, 클럽 가입 신청 등 운영 관련 알림 수신
- 알림 클릭 시 `metadata.link`로 관리 페이지(`/admin/...`)로 바로 이동

---

## 6. 구현 순서

| 단계 | 작업 | 예상 복잡도 |
|------|------|-----------|
| 1 | DB 마이그레이션 (`notifications` 테이블 + Realtime + RLS) | 낮음 |
| 2 | 타입 정의 (`src/lib/notifications/types.ts`) | 낮음 |
| 3 | Server Actions (`src/lib/notifications/actions.ts`) | 중간 |
| 4 | Realtime Hook (`src/lib/realtime/useNotifications.ts`) | 중간 |
| 5 | NotificationBell 컴포넌트 + Navigation 통합 | 중간 |
| 6 | NotificationList 컴포넌트 + `/my/notifications` 페이지 | 중간 |
| 7 | 기존 Server Actions에 알림 생성 로직 통합 | 높음 |
| 8 | AdminHeader 통합 | 낮음 |
| 9 | TypeScript 검증 + 수동 테스트 | 낮음 |

---

## 7. 기술적 고려사항

### 성능
- **인덱스**: `(user_id, is_read, created_at DESC)` — 미읽음 조회 최적화
- **Realtime 필터**: `user_id=eq.{userId}`로 본인 알림만 구독 (서버 측 필터링)
- **Bulk INSERT**: `createBulkNotifications`는 단일 INSERT 문으로 다수 행 삽입

### 보안
- **RLS**: SELECT/UPDATE만 본인, INSERT는 RLS 정책 없음 (admin client 전용)
- **sanitizeInput**: title/message에 적용 (XSS 방지)
- **Server Action 권한**: `createNotification`은 Server Action 내부에서만 호출, 직접 export 안 함

### React 18 Batching
- `useNotifications` 훅에서 ref 기반 상태 관리 (기존 `useMatchesRealtime` 패턴 준수)
- Realtime 콜백에서 `setState` + 외부 변수 설정 패턴 금지

### 확장성 (Phase 2 대비)
- `notification_type` enum은 ALTER TYPE ADD VALUE로 확장 가능
- `metadata` JSONB로 타입별 추가 데이터 유연하게 저장
- `notification_preferences` 테이블 추가 시 `createNotification` 내부에서 체크

---

## 8. Phase 2 로드맵 (참고)

| 기능 | 설명 |
|------|------|
| 알림 설정 페이지 | 사용자별 타입별 on/off (`notification_preferences` 테이블). SUPER_ADMIN 전체 대회 알림 opt-in 포함 |
| Web Push | Service Worker + FCM, 브라우저 닫힌 상태에서도 알림 |
| 이메일 알림 | Supabase Edge Function + Resend, 중요 알림 이메일 전송 |
| 리마인더 | 경기 24시간/1시간 전 자동 알림 (Supabase Cron) |
| 알림 만료 | `expires_at` 컬럼 + 주기적 삭제 (30일 이상) |
| 클럽 알림 확장 | `CLUB_INVITATION` (초대), `CLUB_MEMBER_APPROVED` (승인 완료) 등 |

---

## 9. 검증 기준

### 공통
- [ ] `notifications` 테이블 마이그레이션 성공
- [ ] RLS: 본인 알림만 SELECT/UPDATE 가능
- [ ] Navigation + AdminHeader 벨 아이콘에 미읽음 카운트 실시간 반영
- [ ] `/my/notifications` 페이지에서 알림 목록 조회 + 읽음 처리
- [ ] "모두 읽음" 버튼 동작
- [ ] 알림 클릭 시 `metadata.link` 페이지로 이동

### 사용자 알림
- [ ] 참가 신청 승인 시 → 참가자에게 `ENTRY_APPROVED` 알림 생성
- [ ] 대회 상태 변경 시 → 해당 대회 참가자 전원에게 알림 생성
- [ ] 대진표 생성 시 → 해당 부서 참가자에게 알림 생성

### 관리자 알림
- [ ] 참가 신청 접수 시 → 대회 주최자에게 `ENTRY_SUBMITTED` 알림 생성
- [ ] 참가 취소 시 → 대회 주최자에게 `ENTRY_CANCELLED` 알림 생성
- [ ] 결제 확인 시 → 대회 주최자에게 `PAYMENT_COMPLETED` 알림 생성
- [ ] 클럽 가입 신청 시 (APPROVAL 모드) → 클럽 OWNER/ADMIN에게 `CLUB_JOIN_REQUESTED` 알림 생성

### 클럽 가입 알림
- [ ] 클럽 가입 승인 시 → 신청자에게 `CLUB_MEMBER_APPROVED` 알림 생성
- [ ] 클럽 가입 거절 시 → 신청자에게 `CLUB_MEMBER_REJECTED` 알림 생성

### 빌드
- [ ] TypeScript `tsc --noEmit` 통과
- [ ] `next build` 통과
