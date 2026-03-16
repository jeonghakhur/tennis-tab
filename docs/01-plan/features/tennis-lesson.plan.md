# Plan: 테니스 레슨 신청 및 관리 (tennis-lesson)

## 개요

클럽 내 레슨 프로그램 등록, 수강생 신청, 코치 관리 기능을 제공한다.
클럽 어드민(ADMIN)이 코치를 등록하고 레슨 프로그램을 만들며, 클럽 회원이 신청하여 수강 관리까지 가능한 시스템.

## 배경 및 목적

- 클럽 내 레슨 일정 관리가 현재 카카오톡 등 외부 채널에서 이뤄지고 있어 비효율적
- 레슨 신청/취소/정원 관리를 시스템화하여 클럽 운영 효율 향상
- 수강 이력 데이터 축적으로 회원 레벨 트래킹 가능

## 핵심 개념

```
클럽 (clubs)
  └── 코치 (coaches)  ← 어드민이 등록/관리
  └── 레슨 프로그램 (lesson_programs)  ← 어드민이 개설, 코치 지정
        └── 레슨 세션 (lesson_sessions) ← 날짜/시간별 수업
              └── 레슨 신청 (lesson_enrollments) ← 수강생 신청
```

## 주요 액터

| 액터 | 역할 |
|------|------|
| 클럽 어드민 (ADMIN) | 코치 등록/수정/삭제, 코치 프로필 관리, 레슨 프로그램 생성/관리, 수강생 관리 |
| 클럽 회원 (MEMBER) | 레슨 신청, 취소, 수강 이력 조회 |

> ⚠️ 코치는 시스템 역할(Role)이 아닌 **어드민이 등록하는 대상**입니다.
> 코치 본인이 직접 시스템에 로그인하여 관리하지 않으며, 모든 관리는 어드민이 수행합니다.

## 범위 (Scope)

### In-Scope
- **코치 관리**: 어드민이 코치 등록/수정/비활성화, 코치 프로필(소개, 경력, 자격증) 직접 입력
- **레슨 프로그램**: 제목, 설명, 대상 레벨, 정원, 수강료 안내, 코치 지정
- **레슨 세션**: 날짜/시간, 장소, 반복 패턴(매주 고정 등)
- **수강 신청**: 신청/취소, 정원 체크, 대기자 자동 승격
- **출석 관리**: 세션별 출석/결석 기록
- **알림**: 신청 확정, 세션 리마인더, 취소 알림

### Out-of-Scope (추후 검토)
- 온라인 결제 연동 (토스페이먼츠와 별도 연결)
- 외부 코치 초청 시스템
- 레슨 영상 업로드
- 코치 본인 직접 로그인/관리

## 세션 일정 변경 및 확인 플로우

### 배경
레슨 일정은 코치 사정 또는 수강생 사정에 따라 변경이 필요할 수 있다.
변경 시 월 레슨 횟수에도 영향이 생기므로, 변경 요청 → 상대방 확인 → 확정의 흐름이 필요하다.

### 변경 요청 주체
| 주체 | 변경 사유 예시 |
|------|--------------|
| 어드민 (코치 대리) | 코치 개인 사정, 코트 사정, 기상 등 |
| 수강생 (회원) | 개인 일정, 부상, 출장 등 |

### 일정 변경 플로우

```
[변경 요청]
  어드민 or 수강생이 특정 세션에 대해 변경 요청
  → 변경 희망 날짜/시간 입력
  → 변경 사유 입력 (선택)

      ↓

[상대방 확인]
  - 어드민이 요청한 경우 → 해당 수강생에게 알림 → 수락/거절
  - 수강생이 요청한 경우 → 어드민에게 알림 → 수락/거절

      ↓

[확정]
  수락 시 → 세션 일정 변경 확정, 양쪽 알림 발송
  거절 시 → 원래 일정 유지, 양쪽 알림 발송

      ↓

[월 레슨 횟수 반영]
  - 변경 확정 시 해당 월 레슨 횟수 자동 재계산
  - 취소(보충 없음)의 경우 해당 월 횟수 차감
  - 다른 날로 이동한 경우 횟수 유지
```

### 데이터 모델 추가: `lesson_reschedule_requests`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK → lesson_sessions (원본 세션) |
| enrollment_id | uuid | FK → lesson_enrollments (수강생, nullable - 어드민 요청 시 null) |
| requested_by | uuid | FK → profiles (요청자) |
| requester_type | enum | ADMIN / MEMBER |
| original_date | date | 원래 날짜 |
| original_start_time | time | 원래 시작 시간 |
| original_end_time | time | 원래 종료 시간 |
| requested_date | date | 변경 희망 날짜 |
| requested_start_time | time | 변경 희망 시작 시간 |
| requested_end_time | time | 변경 희망 종료 시간 |
| reason | text | 변경 사유 (선택) |
| status | enum | PENDING / APPROVED / REJECTED |
| responded_by | uuid | FK → profiles (확인자) |
| responded_at | timestamptz | 확인 일시 |
| created_at | timestamptz | |

### 월 레슨 횟수 관리
- `lesson_enrollments`에 `monthly_session_count` (월별 실제 레슨 횟수) 별도 관리
- 변경 확정 시 자동 재계산
- 취소(보충 없음): 해당 월 횟수 차감
- 날짜 이동(보충 있음): 횟수 유지

### 알림 시나리오
| 이벤트 | 알림 대상 |
|--------|---------|
| 어드민이 변경 요청 | 해당 수강생 |
| 수강생이 변경 요청 | 어드민 |
| 변경 수락 | 요청자 |
| 변경 거절 | 요청자 |
| 변경 확정 후 리마인더 | 수강생 (새 날짜 기준) |

## 수강료 정책

### 배경
레슨 수강료는 다음과 같이 다양한 조건에 따라 달라질 수 있어:
- 주중/주말/공휴일 여부
- 월 레슨 횟수 (주 1회 vs 주 2회 등)
- 개인/그룹 레슨 구분
- 시즌 할인 등

따라서 고정 금액(int)으로 저장하기보다 **자유 텍스트 형식**으로 수강료 안내를 입력할 수 있도록 한다.

### 수강료 입력 방식
- `fee_description` 필드: 자유 텍스트 (최대 500자)
- 예시:
  ```
  · 주중 (월~금): 월 8회 기준 120,000원
  · 주말 (토·일): 월 4회 기준 100,000원
  · 공휴일은 주말 요금 적용
  · 개인 레슨 별도 문의
  ```
- 기존 `fee (int)` 필드는 제거하고 텍스트 필드로 대체

## 데이터 모델 (신규 테이블)

### `coaches`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| name | text | 코치명 |
| bio | text | 소개 (어드민 입력) |
| experience | text | 경력 사항 (자유 텍스트) |
| certifications | text[] | 자격증 목록 |
| profile_image_url | text | 프로필 이미지 URL |
| is_active | boolean | 활성 여부 |
| created_by | uuid | FK → profiles (등록한 어드민) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> `user_id` 없음 — 코치는 시스템 계정이 아니므로 profiles와 연결하지 않음

### `lesson_programs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| coach_id | uuid | FK → coaches |
| title | text | 프로그램명 |
| description | text | 설명 |
| target_level | text | 입문/초급/중급/고급/전체 |
| max_participants | int | 최대 정원 |
| fee_description | text | 수강료 안내 (자유 텍스트, 최대 500자) |
| status | enum | DRAFT/OPEN/CLOSED/CANCELLED |
| created_by | uuid | FK → profiles (어드민) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `lesson_sessions`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| program_id | uuid | FK → lesson_programs |
| session_date | date | 수업 날짜 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |
| location | text | 장소 |
| status | enum | SCHEDULED/COMPLETED/CANCELLED |
| notes | text | 메모 |
| created_at | timestamptz | |

### `lesson_enrollments`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| program_id | uuid | FK → lesson_programs |
| member_id | uuid | FK → club_members |
| status | enum | PENDING/CONFIRMED/WAITLISTED/CANCELLED |
| monthly_session_count | jsonb | 월별 레슨 횟수 {"2026-03": 4, "2026-04": 3} |
| enrolled_at | timestamptz | 신청 일시 |
| cancelled_at | timestamptz | 취소 일시 |

### `lesson_attendances`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| session_id | uuid | FK → lesson_sessions |
| enrollment_id | uuid | FK → lesson_enrollments |
| status | enum | PRESENT/ABSENT/LATE |
| recorded_at | timestamptz | |

## 기능 요구사항

### 코치 관리 (어드민 전용)
| ID | 요구사항 |
|----|---------|
| FR-01 | 클럽 어드민이 코치 등록/수정/비활성화 가능 |
| FR-02 | 코치 프로필(이름, 소개, 경력, 자격증, 사진) 어드민이 직접 입력/수정 |
| FR-03 | 코치 목록 및 프로필 클럽 회원에게 공개 |
| FR-04 | 코치 비활성화 시 진행 중인 프로그램에 표시 유지, 신규 배정 불가 |

### 레슨 프로그램 (어드민 전용)
| ID | 요구사항 |
|----|---------|
| FR-05 | 어드민이 프로그램 등록 시 코치 선택 (등록된 코치 목록에서) |
| FR-06 | 수강료는 자유 텍스트로 입력 (주중/주말/횟수별 요금 등 자유롭게 기술) |
| FR-07 | 대상 레벨, 정원 설정 |
| FR-08 | 프로그램 상태 관리 (DRAFT → OPEN → CLOSED/CANCELLED) |
| FR-09 | 프로그램 목록 및 상세 조회 (클럽 회원 공개) |

### 레슨 세션
| ID | 요구사항 |
|----|---------|
| FR-10 | 프로그램별 세션 일정 등록 (단일/반복) |
| FR-11 | 세션 취소 및 변경 알림 발송 |
| FR-12 | 세션 상태 관리 (SCHEDULED/COMPLETED/CANCELLED) |

### 일정 변경
| ID | 요구사항 |
|----|---------|
| FR-20 | 어드민(코치 대리)이 특정 세션에 대해 일정 변경 요청 가능 |
| FR-21 | 수강생(회원)이 본인 세션에 대해 일정 변경 요청 가능 |
| FR-22 | 변경 요청 시 변경 희망 날짜/시간 및 사유 입력 |
| FR-23 | 어드민 요청 → 해당 수강생에게 알림 → 수락/거절 |
| FR-24 | 수강생 요청 → 어드민에게 알림 → 수락/거절 |
| FR-25 | 변경 수락/거절 시 요청자에게 알림 발송 |
| FR-26 | 변경 확정(수락) 시 세션 일정 자동 업데이트 |
| FR-27 | 날짜 이동(보충 있음) → 월 레슨 횟수 유지 |
| FR-28 | 취소(보충 없음) → 해당 월 레슨 횟수 차감 |
| FR-29 | 월별 레슨 횟수 자동 재계산 및 enrollment에 기록 |

### 수강 신청 (회원)
| ID | 요구사항 |
|----|---------|
| FR-13 | 클럽 회원이 프로그램 신청 (CONFIRMED or WAITLISTED) |
| FR-14 | 정원 초과 시 대기자 등록 |
| FR-15 | 수강생 취소 시 대기자 자동 승격 + 알림 |
| FR-16 | 수강 취소 기능 |
| FR-17 | 내 신청 목록 조회 (`/my/lessons`) |

### 출석 관리 (어드민)
| ID | 요구사항 |
|----|---------|
| FR-18 | 어드민이 세션별 출석 체크 |
| FR-19 | 출석률 통계 제공 (회원별, 프로그램별) |

## 페이지 구조

```
/clubs/[id]
  └── ?tab=lessons              ← 레슨 탭 추가 (기존 탭 확장)
        ├── 레슨 목록 (프로그램 카드)
        └── 레슨 상세 → /clubs/[id]/lessons/[programId]

/clubs/[id]/lessons/[programId]
  ├── 프로그램 상세 (코치 정보 포함)
  ├── 수강료 안내 (텍스트)
  ├── 세션 일정
  └── 신청하기 버튼

/my/lessons                     ← 내 수강 신청 목록

/admin/clubs/[id] → 레슨 관리 탭
  ├── 코치 관리 (등록/수정/비활성화)
  ├── 프로그램 관리 (생성/수정/상태변경)
  └── 세션 출석 관리
```

## 예상 파일 변경

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `supabase/migrations/` | 신규 | 6개 테이블 생성 마이그레이션 (reschedule_requests 포함) |
| `src/lib/lessons/actions.ts` | 신규 | 레슨 관련 Server Actions |
| `src/lib/lessons/reschedule.ts` | 신규 | 일정 변경 요청/수락/거절 로직 |
| `src/lib/lessons/types.ts` | 신규 | 타입 정의 |
| `src/lib/coaches/actions.ts` | 신규 | 코치 관련 Server Actions |
| `src/components/clubs/lessons/` | 신규 | 레슨 관련 컴포넌트 |
| `src/components/clubs/lessons/RescheduleModal.tsx` | 신규 | 일정 변경 요청 모달 |
| `src/components/clubs/lessons/RescheduleApproval.tsx` | 신규 | 변경 요청 수락/거절 UI |
| `src/components/clubs/coaches/` | 신규 | 코치 관련 컴포넌트 |
| `src/app/clubs/[id]/lessons/[programId]/page.tsx` | 신규 | 레슨 상세 페이지 |
| `src/app/my/lessons/page.tsx` | 신규 | 내 수강 목록 + 변경 요청 현황 |
| `src/app/clubs/[id]/page.tsx` | 수정 | 레슨 탭 추가 |
| `src/app/admin/clubs/[id]/page.tsx` | 수정 | 코치/레슨 관리 + 변경 요청 목록 |

## 구현 우선순위

| 단계 | 기능 | 비고 |
|------|------|------|
| P1 | DB 스키마 (coaches, lesson_programs, lesson_sessions, lesson_enrollments, lesson_attendances) | MVP |
| P1 | 어드민 코치 등록/수정/비활성화 | 코치 관리 |
| P1 | 어드민 레슨 프로그램 CRUD (수강료 텍스트 입력 포함) | 핵심 |
| P1 | 레슨 목록/상세 + 수강 신청 | 회원 플로우 |
| P2 | 세션 일정 + 대기자 자동 승격 | 운영 자동화 |
| P2 | 일정 변경 요청/수락/거절 + 월 횟수 재계산 | 변경 플로우 |
| P2 | 출석 관리 | 수업 관리 |
| P3 | 수강료 결제 연동 | 토스페이먼츠 |
| P3 | 리마인더 알림 | 기존 notifications 활용 |

## 성공 지표

- 어드민이 5분 내 코치 등록 + 레슨 프로그램 개설 완료
- 회원이 클럽 페이지에서 3탭 클릭 이내로 레슨 신청 완료
- 정원 초과 → 대기자 등록 → 자동 승격 플로우 정상 동작
- 수강료 안내가 주중/주말/횟수별로 자유롭게 표현 가능

## 슬롯 기반 레슨 문의 시스템 (2026-03-15 추가)

### 배경
레슨은 1대1 레슨으로 운영된다. 코치가 가능한 시간대(슬롯)를 미리 열어두면
수강 희망자가 원하는 시간대를 선택하여 레슨 문의를 보내는 방식.

### 슬롯 생성 패턴
- 반복 패턴으로 일괄 생성: 날짜 범위 + 주중/주말/커스텀 요일 + 주1회/주2회 선택
- 생성된 슬롯은 `lesson_sessions` 테이블에 SCHEDULED 상태로 저장
- 어드민이 `/admin/lessons` → 슬롯 관리 탭에서 관리

### 레슨 문의 플로우
```
수강 희망자 → 레슨 목록 → 프로그램 상세 → 원하는 슬롯 선택 → 문의 제출
      ↓
어드민이 문의 확인 → 전화/연락 → 수강 확정 → enrollment 생성
```

### 데이터 모델 추가

**`lesson_inquiries` 업데이트**
| 컬럼 | 변경 | 설명 |
|------|------|------|
| preferred_session_id | 추가 | FK → lesson_sessions (희망 시간대, nullable) |

**`lesson_payments` 신규**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| enrollment_id | uuid | FK → lesson_enrollments |
| amount | integer | 납부 금액 |
| paid_at | date | 입금일 |
| method | enum | BANK_TRANSFER / CASH / OTHER |
| period | text | 납부 월 (YYYY-MM) |
| note | text | 메모 (선택) |
| recorded_by | uuid | FK → profiles (기록한 어드민) |
| created_at | timestamptz | |

**`coaches` 업데이트**
| 컬럼 | 변경 | 설명 |
|------|------|------|
| certification_files | 추가 | text[] — 자격증 첨부파일 URL 목록 |
| profile_image_url | 기존 | 프로필 사진 URL (업로드 지원 추가) |

### 나의 레슨 관리 페이지 (`/my/lessons`)

수강생이 볼 수 있는 통합 레슨 현황 페이지.

**표시 정보:**
- 확정된 수강 목록 (코치 프로필, 프로그램명, 상태)
- 통계 바: 총 레슨 횟수 / 이번 달 레슨 횟수 / 결제 건수
- 다가오는 레슨 일정 (최대 5개) + 일정 조정 요청 버튼
- 레슨비 입금 현황 (납부 월, 금액, 방법, 메모)
- 일정 조정 요청 내역 (PENDING/APPROVED/REJECTED 상태 표시)

**일정 조정 사유:**
- 우천
- 수강생 개인 사정 (출장, 부상 등)
- 코치 요청 (코트 사정, 개인 일정 등)
- 기타

### 어드민 레슨 관리 (`/admin/lessons`) 탭 구성
| 탭 | 기능 |
|----|------|
| 코치 관리 | 코치 등록/수정(사진+자격증 파일 첨부)/비활성화 |
| 프로그램 관리 | 레슨 프로그램 CRUD, 상태 관리, 수강생 목록, 결제 기록 |
| 슬롯 관리 | 반복 패턴으로 세션 일괄 생성, 날짜 미리보기 |
| 문의 관리 | 레슨 문의 목록, 상태 변경, 관리자 메모 |

### 기능 요구사항 추가

| ID | 요구사항 |
|----|---------|
| FR-30 | 코치 등록/수정 시 프로필 사진 업로드 (Storage: coaches/profiles) |
| FR-31 | 코치 자격증 첨부파일 업로드 복수 지원 (Storage: coaches/certifications) |
| FR-32 | 슬롯 반복 패턴 일괄 생성 (날짜 범위 + 주중/주말/커스텀 + 주1/2회) |
| FR-33 | 레슨 문의 시 희망 슬롯 선택 (SCHEDULED 세션 중 선택) |
| FR-34 | 어드민이 수강별 레슨비 결제 기록 등록/조회/삭제 |
| FR-35 | 수강생이 `/my/lessons`에서 레슨비 입금 현황 조회 |
| FR-36 | 수강생이 다가오는 세션에 대해 일정 조정 요청 (날짜/시간/사유 입력) |
| FR-37 | 일정 조정 요청 내역 조회 (수강생) |
| FR-38 | 수강생 레슨 통계: 총 레슨 횟수, 이번 달 레슨 횟수 |

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-03-14 | 초안 작성 |
| 2026-03-14 | 코치 관리 주체를 어드민으로 변경, 수강료를 자유 텍스트 방식으로 변경, 코치 시스템 계정 제거 |
| 2026-03-14 | 일정 변경 플로우 추가 (코치/수강생 양방향 요청, 상대방 확인, 월 레슨 횟수 자동 재계산) |
| 2026-03-15 | 슬롯 기반 문의 시스템, 코치 파일 업로드, 결제 기록, 나의 레슨 관리 페이지 추가 |
| 2026-03-16 | 구현 완료: migration 38 (cert_files + payments), /my/lessons 전면 개편, AdminSlotTab 반복 패턴 |
