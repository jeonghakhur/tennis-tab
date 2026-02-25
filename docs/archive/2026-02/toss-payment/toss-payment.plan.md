# Plan: 토스 페이먼츠 참가비 결제 연동

## Feature
`toss-payment` — 대회 참가 신청 시 토스 페이먼츠 결제위젯을 통한 참가비 온라인 결제

## 배경 & 목적

현재 참가비 수납 방식은 **수동 계좌이체** (bankAccount 안내 → 주최자가 수동 확인)로,
결제 확인이 번거롭고 실시간 상태 반영이 안 된다.

토스 페이먼츠 결제위젯을 연동해 결제 흐름을 자동화하고 `payment_status`를 실시간으로 갱신한다.

## 범위 (In Scope)

- [ ] 참가비 > 0인 대회의 참가 신청 완료 후 결제 화면으로 이동
- [ ] 토스 결제위젯 렌더링 (카드, 간편결제 등)
- [ ] 결제 승인 서버 액션 (paymentKey, orderId, amount 검증 → 승인 API)
- [ ] DB: `entries.payment_status` = `PAID` 업데이트
- [ ] 결제 성공/실패/취소 피드백 UI
- [ ] 결제 취소 (참가 취소 시 토스 결제 취소 API 호출)
- [ ] 어드민: 참가자 목록에서 결제 상태 확인 가능

## 범위 외 (Out of Scope)

- 부분 취소 / 환불 정책 관리 UI (1차 제외)
- 정기결제 / 빌링키 저장
- 해외 간편결제
- 영수증 발급 자동화

## 핵심 사용자 흐름

```
참가 신청 폼 제출
  → createEntry (status: PENDING, payment_status: UNPAID)
  → entryFee > 0 이면 결제 페이지로 이동 (/tournaments/{id}/payment?entryId={entryId})
  → 토스 결제위젯 렌더링 (orderId = entryId 기반 생성)
  → requestPayment() 호출
  → successUrl: /tournaments/{id}/payment/success?paymentKey=&orderId=&amount=
  → 서버: amount 검증 → 토스 승인 API → payment_status = PAID
  → 대회 상세 페이지로 리다이렉트 (결제 완료 토스트)

취소 흐름:
  entry 취소 시 payment_status = PAID 이면 → 토스 결제 취소 API 호출 → 환불
```

## 기술 요구사항

| 항목 | 내용 |
|------|------|
| SDK | `@tosspayments/tosspayments-sdk` v2 |
| 키 관리 | `TOSS_CLIENT_KEY` (public), `TOSS_SECRET_KEY` (server only) |
| orderId 규칙 | `entry-{entryId}-{timestamp}` (토스 최대 64자, 영숫자/-/_) |
| 금액 검증 | 결제 승인 전 DB의 `entry_fee`와 쿼리파라미터 `amount` 비교 필수 |
| 시크릿 키 | Server Action에서만 사용, 클라이언트 노출 금지 |

## DB 변경 사항

```sql
-- 기존 entries 테이블에 추가 (있을 수 있음)
ALTER TABLE entries ADD COLUMN IF NOT EXISTS payment_key TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS toss_order_id TEXT;
-- payment_status 컬럼은 이미 존재
-- UNPAID | PAID | CANCELLED | REFUNDED
```

## 성공 지표

- 참가비 있는 대회: 결제 완료 후 `payment_status = PAID` 자동 반영
- 참가 취소 시 PAID 상태면 자동 환불 처리
- 어드민에서 결제 상태 실시간 확인 가능

## 의존성

- 토스 페이먼츠 계약 / API 키 (테스트 키로 개발 먼저 진행)
- 기존 `entries` 테이블, `createEntry` Server Action
- `TournamentEntryActionsNew.tsx` 참가 신청 흐름

## 우선순위

**P0** (필수):
- 결제위젯 연동 + 승인 서버 액션
- payment_status DB 반영

**P1** (중요):
- 취소 시 자동 환불
- 어드민 결제 상태 표시

**P2** (추후):
- 결제 내역 페이지 (`/my/payments`)
- 웹훅 연동 (네트워크 오류 대비 이중 검증)
