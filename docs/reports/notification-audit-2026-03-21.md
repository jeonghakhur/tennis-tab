# 알림 시스템 감사 리포트

**작성일**: 2026-03-21
**범위**: 레슨 예약/수강 관련 알림 전체 점검 및 보완

---

## 1. 현황 분석

### 1.1 기존 알림 시스템 구조

| 구분 | 현황 |
|------|------|
| **인앱 알림** | notifications 테이블 + Realtime + NotificationBell UI |
| **알림톡** | 솔라피 카카오 알림톡 8개 함수 (alimtalk.ts) |
| **NotificationType** | 15종 (대회 10 + 관리자 4 + LESSON_INQUIRY 1) |

### 1.2 발견된 누락 사항

#### 슬롯 기반 예약 시스템 (slot-actions.ts) — 알림 전무

| 이벤트 | 인앱 알림 | 알림톡 | 비고 |
|--------|-----------|--------|------|
| createBooking (예약 신청) | **없음** | **없음** | 코치가 새 예약을 인지 못함 |
| confirmBooking (예약 확정) | **없음** | **없음** | 고객이 확정 여부 알 수 없음 |
| cancelBooking (예약 거절/취소) | **없음** | **없음** | 고객이 취소 사실 모름 |
| lockSlot (코치 직접 배정) | **없음** | N/A | 배정된 회원이 모름 |

#### 수강 시스템 (actions.ts) — 부분 누락

| 이벤트 | 인앱 알림 | 알림톡 | 비고 |
|--------|-----------|--------|------|
| enrollLesson (수강 신청) | **없음** | O (고객+코치) | 코치 인앱 알림 없음 |
| cancelEnrollment (회원 취소) | **없음** | **없음** | 코치가 취소 인지 못함 |
| updateEnrollmentStatus(CONFIRMED) | **없음** | O (고객) | 고객 인앱 알림 없음 |
| updateEnrollmentStatus(CANCELLED) | **없음** | **없음** | 고객이 거절 모름 |

#### DB 누락

- notifications 테이블에 DELETE 정책 누락 (사용자가 알림 삭제 불가)
- notification_type enum에 레슨 관련 타입 없음

---

## 2. 수정 내용

### 2.1 새 NotificationType 6종 추가

| 타입 | 설명 | 수신자 |
|------|------|--------|
| `LESSON_BOOKING_NEW` | 새 예약 접수 | 코치 |
| `LESSON_BOOKING_CONFIRMED` | 예약/수강 확정 | 고객(회원) |
| `LESSON_BOOKING_CANCELLED` | 예약/수강 거절/취소 | 고객(회원) |
| `LESSON_SLOT_LOCKED` | 코치 직접 배정 | 배정된 회원 |
| `LESSON_ENROLLED` | 새 수강 신청 | 코치 |
| `LESSON_ENROLLMENT_CANCELLED` | 회원 수강 취소 | 코치 |

**변경 파일**: `src/lib/notifications/types.ts`

### 2.2 DB 마이그레이션 (51_lesson_notification_types.sql)

- `notification_type` enum에 6개 값 추가
- notifications 테이블 DELETE 정책 추가 (기존 누락 수정)

### 2.3 알림톡 함수 2종 추가 (alimtalk.ts)

| 함수 | 용도 | 환경변수 |
|------|------|----------|
| `sendLessonBookingConfirmAlimtalk` | 슬롯 예약 확정 (고객) | `SOLAPI_TEMPLATE_LESSON_BOOKING_CONFIRM` |
| `sendLessonBookingCancelAlimtalk` | 슬롯 예약 취소 (고객) | `SOLAPI_TEMPLATE_LESSON_BOOKING_CANCEL` |

### 2.4 slot-actions.ts — 4개 이벤트에 알림 추가

| 함수 | 추가된 알림 |
|------|------------|
| `createBooking` | 코치 인앱 알림 (LESSON_BOOKING_NEW) |
| `confirmBooking` | 회원: 인앱 + 알림톡 / 비회원: 알림톡만 |
| `cancelBooking` | 회원: 인앱 + 알림톡 / 비회원: 알림톡만 |
| `lockSlot` | 회원 인앱 알림 (LESSON_SLOT_LOCKED) |

### 2.5 actions.ts — 3개 이벤트에 알림 추가

| 함수 | 추가된 알림 |
|------|------------|
| `enrollLesson` | 코치 인앱 알림 (LESSON_ENROLLED) |
| `cancelEnrollment` | 코치 인앱 알림 (LESSON_ENROLLMENT_CANCELLED) |
| `updateEnrollmentStatus` | 확정: 인앱(LESSON_BOOKING_CONFIRMED) + 알림톡 / 취소: 인앱(LESSON_BOOKING_CANCELLED) |

### 2.6 NotificationItem.tsx — 아이콘 매핑 추가

| 타입 | 아이콘 | 색상 |
|------|--------|------|
| LESSON_BOOKING_NEW | CalendarPlus | blue |
| LESSON_BOOKING_CONFIRMED | CalendarCheck | emerald |
| LESSON_BOOKING_CANCELLED | CalendarX | red |
| LESSON_SLOT_LOCKED | Lock | purple |
| LESSON_ENROLLED | BookOpen | blue |
| LESSON_ENROLLMENT_CANCELLED | BookX | orange |

---

## 3. 설계 원칙

- **fire-and-forget**: 모든 알림은 try-catch로 감싸서 실패해도 메인 로직 차단 안 함
- **비회원 처리**: 인앱 알림 불가 (user_id 없음), 알림톡만 발송 (guest_phone 사용)
- **회원 처리**: 인앱 알림 + 알림톡 동시 발송
- **헬퍼 분리**: `getCoachInfoForSlots()`, `getMemberInfo()` 헬퍼로 중복 조회 코드 최소화

---

## 4. 빌드 검증

```
npx tsc --noEmit — 수정한 파일에서 새 타입 에러 없음
기존 에러: solapi 모듈 미설치(개발환경), .next 캐시 이슈 — 기존 이슈
```

---

## 5. 남은 작업 (배포 전 필요)

### 5.1 솔라피 템플릿 등록 필요

| 환경변수 | 상태 | 비고 |
|----------|------|------|
| `SOLAPI_TEMPLATE_LESSON_BOOKING_CONFIRM` | **미등록** | 솔라피 콘솔에서 템플릿 생성 + 검수 필요 |
| `SOLAPI_TEMPLATE_LESSON_BOOKING_CANCEL` | **미등록** | 솔라피 콘솔에서 템플릿 생성 + 검수 필요 |

기존 환경변수 (확인 필요):
- `SOLAPI_TEMPLATE_LESSON_APPLY` — 수강 신청 (고객)
- `SOLAPI_TEMPLATE_LESSON_APPLY_COACH` — 수강 신청 (코치)
- `SOLAPI_TEMPLATE_LESSON_CONFIRM` — 수강 확정 (고객)
- `SOLAPI_TEMPLATE_LESSON_RESERVATION` — 레슨 예약 문의 (코치)

### 5.2 DB 마이그레이션 적용

```bash
# Supabase 대시보드에서 또는 CLI로 실행
supabase db push
```

### 5.3 sendLessonAlimtalk 데이터 품질

`actions.ts`의 `sendLessonAlimtalk()` 헬퍼에서 `lessonStartDate`, `lessonInfo`, `lessonDays` 필드가 모두 '-'로 하드코딩되어 있음. 프로그램 테이블에 해당 데이터가 없어서 발생하는 구조적 문제 — 프로그램 스키마에 시작일/요일 필드 추가 시 연동 필요.

### 5.4 E2E 테스트 업데이트

`e2e/notifications.spec.ts`에 새 6종 알림 타입 테스트 추가 필요.

---

## 6. 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/notifications/types.ts` | NotificationType 6종 추가 |
| `src/lib/solapi/alimtalk.ts` | 알림톡 함수 2종 추가 |
| `src/lib/lessons/slot-actions.ts` | 4개 이벤트에 알림 로직 + 헬퍼 함수 |
| `src/lib/lessons/actions.ts` | 3개 이벤트에 알림 로직 + 헬퍼 함수 |
| `src/components/notifications/NotificationItem.tsx` | 아이콘/색상 매핑 6종 추가 |
| `supabase/migrations/51_lesson_notification_types.sql` | enum 6종 + DELETE 정책 |
| `docs/reports/notification-audit-2026-03-21.md` | 이 리포트 |
