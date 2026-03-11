# Plan: 테니스 레슨 신청 및 관리 (tennis-lesson)

## 개요

클럽 내 레슨 프로그램 등록, 수강생 신청, 코치 관리 기능을 제공한다.
클럽 임원(OWNER/ADMIN)이 레슨 프로그램을 만들고, 클럽 회원이 신청하여 수강 관리까지 가능한 시스템.

## 배경 및 목적

- 클럽 내 레슨 일정 관리가 현재 카카오톡 등 외부 채널에서 이뤄지고 있어 비효율적
- 레슨 신청/취소/정원 관리를 시스템화하여 클럽 운영 효율 향상
- 수강 이력 데이터 축적으로 회원 레벨 트래킹 가능

## 핵심 개념

```
클럽 (clubs)
  └── 레슨 프로그램 (lesson_programs)  ← 코치가 개설
        └── 레슨 세션 (lesson_sessions) ← 날짜/시간별 수업
              └── 레슨 신청 (lesson_enrollments) ← 수강생 신청
```

## 주요 액터

| 액터 | 역할 |
|------|------|
| 코치 (COACH) | 레슨 프로그램 생성, 세션 일정 관리, 출석 확인 |
| 클럽 임원 (OWNER/ADMIN) | 코치 지정, 프로그램 승인, 수강생 관리 |
| 클럽 회원 (MEMBER) | 레슨 신청, 취소, 수강 이력 조회 |

## 범위 (Scope)

### In-Scope
- **레슨 프로그램**: 제목, 설명, 대상 레벨, 정원, 수강료, 코치 정보
- **레슨 세션**: 날짜/시간, 장소, 반복 패턴(매주 고정 등)
- **수강 신청**: 신청/취소, 정원 체크, 대기자 자동 승격
- **출석 관리**: 세션별 출석/결석 기록
- **코치 프로필**: 소개, 경력, 자격증
- **알림**: 신청 확정, 세션 리마인더, 취소 알림

### Out-of-Scope (추후 검토)
- 온라인 결제 연동 (토스페이먼츠와 별도 연결)
- 외부 코치 초청 시스템
- 레슨 영상 업로드

## 데이터 모델 (신규 테이블)

### `coaches`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| user_id | uuid | FK → profiles (nullable, 비회원 코치) |
| name | text | 코치명 |
| bio | text | 소개 |
| certifications | text[] | 자격증 목록 |
| is_active | boolean | 활성 여부 |
| created_at | timestamptz | |

### `lesson_programs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| coach_id | uuid | FK → coaches |
| title | text | 프로그램명 |
| description | text | 설명 |
| target_level | text | 입문/초급/중급/고급 |
| max_participants | int | 최대 정원 |
| fee | int | 수강료 (원) |
| status | enum | DRAFT/OPEN/CLOSED/CANCELLED |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | |

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

### 코치 관리
| ID | 요구사항 |
|----|---------|
| FR-01 | 클럽 임원이 코치 등록/수정/비활성화 가능 |
| FR-02 | 코치는 클럽 회원 또는 외부인 모두 가능 |
| FR-03 | 코치 프로필 페이지 (공개) |

### 레슨 프로그램
| ID | 요구사항 |
|----|---------|
| FR-04 | 코치/임원이 프로그램 등록 (DRAFT → OPEN) |
| FR-05 | 대상 레벨, 정원, 수강료 설정 |
| FR-06 | 프로그램 상태 관리 (OPEN/CLOSED/CANCELLED) |
| FR-07 | 프로그램 목록 및 상세 조회 (클럽 회원 공개) |

### 레슨 세션
| ID | 요구사항 |
|----|---------|
| FR-08 | 프로그램별 세션 일정 등록 (단일/반복) |
| FR-09 | 세션 취소 및 변경 알림 발송 |
| FR-10 | 세션 상태 관리 (SCHEDULED/COMPLETED/CANCELLED) |

### 수강 신청
| ID | 요구사항 |
|----|---------|
| FR-11 | 클럽 회원이 프로그램 신청 (CONFIRMED or WAITLISTED) |
| FR-12 | 정원 초과 시 대기자 등록 |
| FR-13 | 수강생 취소 시 대기자 자동 승격 + 알림 |
| FR-14 | 수강 취소 기능 |
| FR-15 | 내 신청 목록 조회 (`/my/lessons`) |

### 출석 관리
| ID | 요구사항 |
|----|---------|
| FR-16 | 코치/임원이 세션별 출석 체크 |
| FR-17 | 출석률 통계 제공 (회원별, 프로그램별) |

## 페이지 구조

```
/clubs/[id]
  └── ?tab=lessons           ← 레슨 탭 추가 (기존 탭 확장)
        ├── 레슨 목록
        └── 레슨 상세 모달 or /clubs/[id]/lessons/[programId]

/clubs/[id]/lessons/[programId]
  ├── 프로그램 상세
  ├── 세션 일정
  └── 신청하기 버튼

/my/lessons                  ← 내 수강 신청 목록

/admin/clubs/[id] → 레슨 관리 탭
  ├── 코치 관리
  ├── 프로그램 관리
  └── 세션 출석 관리
```

## 예상 파일 변경

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `supabase/migrations/` | 신규 | 4개 테이블 생성 마이그레이션 |
| `src/lib/lessons/actions.ts` | 신규 | 레슨 관련 Server Actions |
| `src/lib/lessons/types.ts` | 신규 | 타입 정의 |
| `src/components/clubs/lessons/` | 신규 | 레슨 관련 컴포넌트 |
| `src/app/clubs/[id]/lessons/[programId]/page.tsx` | 신규 | 레슨 상세 페이지 |
| `src/app/my/lessons/page.tsx` | 신규 | 내 수강 목록 |
| `src/app/clubs/[id]/page.tsx` | 수정 | 레슨 탭 추가 |
| `src/app/admin/clubs/[id]/page.tsx` | 수정 | 레슨 관리 탭 추가 |

## 구현 우선순위

| 단계 | 기능 | 비고 |
|------|------|------|
| P1 | DB 스키마 + 코치 관리 + 프로그램 CRUD | MVP |
| P1 | 레슨 목록/상세 + 수강 신청 | 핵심 플로우 |
| P2 | 세션 일정 + 대기자 자동 승격 | 운영 자동화 |
| P2 | 출석 관리 | 수업 관리 |
| P3 | 수강료 결제 연동 | 토스페이먼츠 |
| P3 | 리마인더 알림 | 기존 notifications 활용 |

## 성공 지표

- 클럽 임원이 5분 내 레슨 프로그램 등록 가능
- 회원이 클럽 페이지에서 3탭 클릭 이내로 레슨 신청 완료
- 정원 초과 → 대기자 등록 → 자동 승격 플로우 정상 동작
