# Design: 테니스 레슨 신청 및 관리 (Tennis Lesson)

> **구현 상태**: 미구현 🔲
> **참고 플랜**: `docs/01-plan/features/tennis-lesson.plan.md`

---

## DB 스키마

### ENUM 타입

```sql
CREATE TYPE lesson_program_status   AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE lesson_session_status   AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE enrollment_status       AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED');
CREATE TYPE attendance_lesson_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TYPE reschedule_requester    AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE reschedule_status       AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
```

### `coaches` 테이블

```sql
CREATE TABLE coaches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  bio                 TEXT,
  experience          TEXT,
  certifications      TEXT[] NOT NULL DEFAULT '{}',
  profile_image_url   TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `lesson_programs` 테이블

```sql
CREATE TABLE lesson_programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  coach_id            UUID NOT NULL REFERENCES coaches(id),
  title               TEXT NOT NULL,
  description         TEXT,
  target_level        TEXT NOT NULL DEFAULT '전체',  -- 입문/초급/중급/고급/전체
  max_participants    INT NOT NULL DEFAULT 10,
  fee_description     TEXT CHECK (char_length(fee_description) <= 500),
  status              lesson_program_status NOT NULL DEFAULT 'DRAFT',
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `lesson_sessions` 테이블

```sql
CREATE TABLE lesson_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  location      TEXT,
  status        lesson_session_status NOT NULL DEFAULT 'SCHEDULED',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_lesson_time CHECK (end_time > start_time)
);
```

### `lesson_enrollments` 테이블

```sql
CREATE TABLE lesson_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id            UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  member_id             UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  status                enrollment_status NOT NULL DEFAULT 'PENDING',
  monthly_session_count JSONB NOT NULL DEFAULT '{}',  -- {"2026-03": 4, "2026-04": 3}
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at          TIMESTAMPTZ,

  UNIQUE(program_id, member_id)
);
```

### `lesson_attendances` 테이블

```sql
CREATE TABLE lesson_attendances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  enrollment_id   UUID NOT NULL REFERENCES lesson_enrollments(id) ON DELETE CASCADE,
  status          attendance_lesson_status NOT NULL DEFAULT 'ABSENT',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, enrollment_id)
);
```

### `lesson_reschedule_requests` 테이블

```sql
CREATE TABLE lesson_reschedule_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  enrollment_id         UUID REFERENCES lesson_enrollments(id),  -- nullable (어드민 요청 시)
  requested_by          UUID NOT NULL REFERENCES profiles(id),
  requester_type        reschedule_requester NOT NULL,
  original_date         DATE NOT NULL,
  original_start_time   TIME NOT NULL,
  original_end_time     TIME NOT NULL,
  requested_date        DATE NOT NULL,
  requested_start_time  TIME NOT NULL,
  requested_end_time    TIME NOT NULL,
  reason                TEXT,
  status                reschedule_status NOT NULL DEFAULT 'PENDING',
  responded_by          UUID REFERENCES profiles(id),
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## RLS 정책

```sql
-- coaches: 클럽 회원 읽기 / 어드민만 쓰기
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches_select" ON coaches FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = coaches.club_id AND user_id = auth.uid())
);
CREATE POLICY "coaches_insert" ON coaches FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = coaches.club_id AND user_id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "coaches_update" ON coaches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = coaches.club_id AND user_id = auth.uid() AND role = 'ADMIN')
);

-- lesson_programs: 클럽 회원 읽기 / 어드민만 쓰기
ALTER TABLE lesson_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_programs_select" ON lesson_programs FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = lesson_programs.club_id AND user_id = auth.uid())
);
CREATE POLICY "lesson_programs_admin_write" ON lesson_programs FOR ALL USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = lesson_programs.club_id AND user_id = auth.uid() AND role = 'ADMIN')
);

-- lesson_enrollments: 본인 or 어드민만 접근
ALTER TABLE lesson_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_select" ON lesson_enrollments FOR SELECT USING (
  member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM lesson_programs lp
    JOIN club_members cm ON cm.club_id = lp.club_id
    WHERE lp.id = lesson_enrollments.program_id AND cm.user_id = auth.uid() AND cm.role = 'ADMIN'
  )
);
```

---

## Server Actions

### `src/lib/lessons/actions.ts`

```typescript
// 코치 관련
export async function createCoach(clubId: string, data: CreateCoachInput)
export async function updateCoach(coachId: string, data: UpdateCoachInput)
export async function deactivateCoach(coachId: string)
export async function getCoachesByClub(clubId: string)

// 레슨 프로그램 관련
export async function createLessonProgram(clubId: string, data: CreateProgramInput)
export async function updateLessonProgram(programId: string, data: UpdateProgramInput)
export async function updateProgramStatus(programId: string, status: LessonProgramStatus)
export async function getLessonPrograms(clubId: string)
export async function getLessonProgramDetail(programId: string)

// 수강 신청 관련
export async function enrollLesson(programId: string)
export async function cancelEnrollment(enrollmentId: string)
export async function getMyEnrollments()

// 출석 관련
export async function recordAttendance(sessionId: string, enrollmentId: string, status: AttendanceLessonStatus)
export async function getSessionAttendances(sessionId: string)
```

### `src/lib/lessons/reschedule.ts`

```typescript
export async function requestReschedule(sessionId: string, data: RescheduleRequestInput)
export async function approveReschedule(requestId: string)
export async function rejectReschedule(requestId: string)
export async function recalculateMonthlyCount(enrollmentId: string)
```

---

## 타입 정의 (`src/lib/lessons/types.ts`)

```typescript
export type Coach = {
  id: string
  clubId: string
  name: string
  bio: string | null
  experience: string | null
  certifications: string[]
  profileImageUrl: string | null
  isActive: boolean
  createdAt: string
}

export type LessonProgram = {
  id: string
  clubId: string
  coachId: string
  coach: Coach
  title: string
  description: string | null
  targetLevel: string
  maxParticipants: number
  feeDescription: string | null
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
  enrollmentCount: number
  createdAt: string
}

export type LessonSession = {
  id: string
  programId: string
  sessionDate: string
  startTime: string
  endTime: string
  location: string | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  notes: string | null
}

export type LessonEnrollment = {
  id: string
  programId: string
  memberId: string
  status: 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'
  monthlySessionCount: Record<string, number>
  enrolledAt: string
}

export type CreateCoachInput = {
  name: string
  bio?: string
  experience?: string
  certifications?: string[]
  profileImageUrl?: string
}

export type CreateProgramInput = {
  coachId: string
  title: string
  description?: string
  targetLevel: string
  maxParticipants: number
  feeDescription?: string
}

export type RescheduleRequestInput = {
  enrollmentId?: string
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  reason?: string
}
```

---

## 페이지 구조 및 컴포넌트

### 페이지 목록

| 경로 | 설명 | 권한 |
|------|------|------|
| `/clubs/[id]?tab=lessons` | 레슨 탭 (프로그램 목록) | 클럽 회원 |
| `/clubs/[id]/lessons/[programId]` | 레슨 상세 + 신청 | 클럽 회원 |
| `/my/lessons` | 내 수강 신청 목록 | 로그인 사용자 |
| `/admin/clubs/[id]` → 레슨 탭 | 코치/프로그램/출석 관리 | 어드민 |

---

### 컴포넌트 구조

```
src/components/clubs/lessons/
├── LessonTabContent.tsx          # 레슨 탭 전체 (프로그램 목록)
├── LessonProgramCard.tsx         # 프로그램 카드 (레벨 뱃지, 코치명, 정원 현황)
├── LessonProgramDetail.tsx       # 프로그램 상세
├── LessonEnrollButton.tsx        # 신청/취소/대기 버튼 (상태별 분기)
├── LessonSessionList.tsx         # 세션 일정 목록
├── RescheduleModal.tsx           # 일정 변경 요청 모달
├── RescheduleApproval.tsx        # 변경 요청 수락/거절 UI (어드민)
└── AttendanceSheet.tsx           # 출석 체크 시트 (어드민)

src/components/clubs/coaches/
├── CoachList.tsx                 # 코치 목록 카드
├── CoachCard.tsx                 # 코치 프로필 카드
├── CoachForm.tsx                 # 코치 등록/수정 폼
└── CoachProfileImage.tsx         # 코치 이미지 업로드
```

---

### 주요 컴포넌트 상세

#### `LessonProgramCard.tsx`

```
┌─────────────────────────────────┐
│ [코치 이미지] 홈 트레이닝 레슨   │
│              레벨: 초급          │
│ 코치: 김민수                    │
│ 정원: 6/10명 ████░░ OPEN        │
│ 수강료: 주중 월 8회 12만원       │
│                    [신청하기] →  │
└─────────────────────────────────┘
```

#### `LessonProgramDetail.tsx`

```
┌─────────────────────────────────┐
│ ← 홈 트레이닝 레슨              │
│ ─────────────────────────────── │
│ 👤 코치 정보                    │
│   [이미지] 김민수 코치           │
│   경력: 10년 / KTA 공인 코치    │
│   자격증: KTA, ITF              │
│ ─────────────────────────────── │
│ 📋 프로그램 정보                 │
│   대상: 초급 | 정원: 10명       │
│ ─────────────────────────────── │
│ 💰 수강료 안내                   │
│   주중(월~금): 월 8회 120,000원  │
│   주말(토·일): 월 4회 100,000원  │
│ ─────────────────────────────── │
│ 📅 레슨 일정                    │
│   3/18 (화) 10:00~11:00 망원코트│
│   3/25 (화) 10:00~11:00 망원코트│
│ ─────────────────────────────── │
│        [수강 신청하기]           │
└─────────────────────────────────┘
```

#### `CoachForm.tsx` (어드민)

```
┌─────────────────────────────────┐
│ 코치 등록                        │
│ ─────────────────────────────── │
│ 이름 *          [김민수        ] │
│ 소개            [              ] │
│                 [              ] │
│ 경력            [              ] │
│ 자격증 (엔터로 추가)             │
│   [KTA ×] [ITF ×] [+추가]      │
│ 프로필 사진     [업로드]         │
│ ─────────────────────────────── │
│          [취소]  [등록하기]      │
└─────────────────────────────────┘
```

---

## 수강 신청 상태 플로우

```
신청 버튼 클릭
    ↓
정원 확인
  ├── 여유 있음 → CONFIRMED
  └── 정원 초과 → WAITLISTED

수강생 취소 (CONFIRMED → CANCELLED)
    ↓
대기자 자동 승격 (WAITLISTED → CONFIRMED) + 알림
```

---

## 알림 연동 (`notifications` 테이블 활용)

| 이벤트 | 대상 | 메시지 |
|--------|------|--------|
| 신청 확정 | 수강생 | "{프로그램명}" 수강 신청이 확정되었습니다 |
| 대기 등록 | 수강생 | "{프로그램명}" 대기자로 등록되었습니다 |
| 대기→확정 승격 | 수강생 | "{프로그램명}" 수강 신청이 확정되었습니다 |
| 세션 리마인더 | 수강생 | 내일 레슨이 있습니다 ({시간}, {장소}) |
| 변경 요청 수신 | 어드민/수강생 | 일정 변경 요청이 도착했습니다 |
| 변경 수락/거절 | 요청자 | 일정 변경 요청이 {수락/거절}되었습니다 |

---

## 구현 우선순위

| 단계 | 작업 | 예상 시간 |
|------|------|---------|
| P1 | DB 마이그레이션 (6개 테이블 + ENUM) | 1h |
| P1 | 코치 등록/수정/비활성화 (어드민) | 2h |
| P1 | 레슨 프로그램 CRUD + 상태 관리 | 3h |
| P1 | 레슨 탭 + 프로그램 목록/상세 | 2h |
| P1 | 수강 신청/취소 + 정원 체크 | 2h |
| P2 | 대기자 자동 승격 | 1h |
| P2 | 일정 변경 요청/수락/거절 | 3h |
| P2 | 월 횟수 자동 재계산 | 1h |
| P2 | 출석 체크 (어드민) | 2h |
| P3 | 리마인더 알림 연동 | 1h |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-03-16 | 초안 작성 (플랜 기반 디자인 문서화) |
