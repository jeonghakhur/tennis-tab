# Plan: 토스페이먼츠 결제 모듈 (대회 참가비)

## 1. 개요

### 1.1 배경
현재 대회 참가 신청 시 `entry_fee` 금액이 설정되어 있고 `tournament_entries.payment_status`
컬럼도 존재하지만, 실제 결제 수단이 없어 관리자가 수동으로 입금 확인 후 상태를 변경하는 구조다.
토스페이먼츠를 연동하여 참가자가 직접 온라인 결제를 완료하면 자동으로 참가가 확정되도록 한다.

### 1.2 목표
- 대회 참가 신청 → 토스페이먼츠 결제 → 자동 참가 확정 플로우 구축
- 결제 실패/취소/환불 처리 자동화
- 관리자 결제 현황 조회 및 수동 환불 기능

### 1.3 범위

**In Scope:**
- 토스페이먼츠 일반결제 (카드, 계좌이체, 가상계좌)
- 참가 신청 → 결제 → 확정 자동 플로우
- 결제 실패 시 재시도
- 관리자 환불 처리
- 내 결제 내역 조회 (`/my/payments`)

**Out of Scope (향후):**
- 정기 결제 (구독)
- 분할 결제
- 결제 위젯 (Payment Widget) - 일반결제 우선
- 포인트/쿠폰 시스템

---

## 2. 사용자 스토리

| ID | 역할 | 스토리 | 우선순위 |
|----|------|--------|----------|
| US-01 | 참가자 | 대회 참가 신청 후 토스페이먼츠로 참가비를 결제할 수 있다 | P0 |
| US-02 | 참가자 | 결제 완료 즉시 참가가 확정됨을 확인할 수 있다 | P0 |
| US-03 | 참가자 | 결제 실패 시 안내 메시지를 보고 재시도할 수 있다 | P0 |
| US-04 | 참가자 | 내 결제 내역을 `/my/payments`에서 확인할 수 있다 | P1 |
| US-05 | 참가자 | 대회 취소 등 환불 사유 발생 시 환불 신청을 할 수 있다 | P1 |
| US-06 | 주최자 | 대회 생성 시 참가비를 0원으로 설정하면 무료 대회가 된다 | P0 |
| US-07 | ADMIN | 결제 내역 전체를 조회할 수 있다 | P1 |
| US-08 | ADMIN | 특정 결제에 대해 환불을 처리할 수 있다 | P1 |

---

## 3. 결제 플로우

### 3.1 일반결제 플로우 (토스페이먼츠 SDK v2)

```
[참가 신청 폼 제출]
       ↓
[Server Action: createEntry]
  - entry 생성 (status=PENDING, payment_status=PENDING)
  - order_id 생성 (tennis-tab-{entryId}-{timestamp})
  - ⚠️ orderId + amount를 DB에 저장 (결제 전 서버 저장 필수 - 금액 위변조 방지)
       ↓
[entry_fee === 0?]
  → YES: payment_status=COMPLETED, status=APPROVED → 완료
  → NO: 결제 페이지로 이동
       ↓
[Client: SDK v2 방식]
  const tossPayments = await loadTossPayments(clientKey)
  const payment = tossPayments.payment({ customerKey })  // 회원: userId, 비회원: ANONYMOUS
  await payment.requestPayment({
    method: "CARD" | "VIRTUAL_ACCOUNT" | "TRANSFER",  // 결제수단 명시
    amount: { currency: "KRW", value: entryFee },      // ⚠️ 객체 형태 필수 (v2 변경)
    orderId, orderName,
    successUrl: /api/payments/toss/success,
    failUrl: /api/payments/toss/fail,
  })
       ↓
[토스페이먼츠 결제창]
       ↓ 결제 완료 (successUrl로 리다이렉트)
[GET /api/payments/toss/success?paymentType=NORMAL&paymentKey=&orderId=&amount=]
  ⚠️ v2에서 paymentType 쿼리 파라미터 추가됨
  - 금액 위변조 검증: 쿼리 amount === DB entry_fee
  - Server: POST https://api.tosspayments.com/v1/payments/confirm
    { paymentKey, orderId, amount }
  - tournament_entries 업데이트:
    - payment_status = COMPLETED
    - toss_payment_key = paymentKey
    - payment_confirmed_at = now()
    - status = APPROVED (참가 확정)
  - /tournaments/[id]?payment=success 로 리다이렉트
       ↓ 결제 실패/취소 (failUrl로 리다이렉트)
[GET /api/payments/toss/fail?code=&message=&orderId=]
  ⚠️ PAY_PROCESS_CANCELED (구매자 직접 취소): orderId 전달 안 됨 → null 체크 필수
  - orderId 있는 경우: tournament_entries 업데이트 payment_status = FAILED
  - orderId 없는 경우: 로그만 기록 (entry는 PENDING 유지, 재결제 허용)
  - /tournaments/[id]?payment=failed 로 리다이렉트
```

### 3.2 무료 대회 (entry_fee = 0)

결제 단계 없이 신청 즉시 `APPROVED` 상태로 확정.
현재 동작과 동일하게 유지.

### 3.3 환불 플로우

```
[ADMIN 환불 요청 or 참가 취소]
       ↓
[Server Action: refundPayment]
  - POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancels
  - tournament_entries 업데이트:
    - payment_status = CANCELLED
    - status = CANCELLED
```

---

## 4. 페이지 구조

```
/tournaments/[id]
  └── TournamentEntryActionsNew  ← 결제 버튼 추가
      └── 결제 후: ?payment=success / ?payment=failed 쿼리로 결과 표시

/api/payments/toss/success      # Route Handler (GET) - 결제 승인 처리
/api/payments/toss/fail         # Route Handler (GET) - 결제 실패 처리
/api/payments/toss/webhook      # Route Handler (POST) - 웹훅 (가상계좌 등)

/my/payments                    # 내 결제 내역 (신규 페이지)
/admin/payments                 # 전체 결제 내역 + 환불 (신규 페이지)
```

---

## 5. 데이터 모델 변경

### 5.1 tournament_entries 컬럼 추가

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `toss_order_id` | text | null | 토스 주문번호 (tennis-tab-{id}-{ts}) |
| `toss_payment_key` | text | null | 토스 결제키 (승인 후 저장) |

> 기존 `payment_status`, `payment_confirmed_at` 컬럼 재활용.

### 5.2 PaymentStatus 확장 검토

현재: `PENDING | COMPLETED | FAILED | CANCELLED`

토스 API 반환값과의 매핑:
| 토스 status | 우리 PaymentStatus |
|-------------|-------------------|
| `IN_PROGRESS` | `PENDING` |
| `DONE` | `COMPLETED` |
| `CANCELED` | `CANCELLED` |
| `PARTIAL_CANCELED` | `CANCELLED` |
| `ABORTED` | `FAILED` |
| `EXPIRED` | `FAILED` |

---

## 6. 환경변수

```env
# .env.local
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...   # 클라이언트 (공개 가능)
TOSS_SECRET_KEY=test_sk_...              # 서버 전용 (절대 노출 금지)
```

> 테스트: `test_ck_` / `test_sk_` 접두사
> 운영: `live_ck_` / `live_sk_` 접두사

---

## 7. 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 토스 SDK | `@tosspayments/tosspayments-sdk` v2 | 공식 TypeScript SDK (v2 API) |
| 결제 타입 | 일반결제 (`tossPayments.payment().requestPayment`) | 단건 결제, 구현 단순 |
| 콜백 처리 | Next.js Route Handler | Server Action은 redirect 제약 있음 |
| 금액 검증 | 서버에서 DB 비교 | 클라이언트 위변조 방지 |
| customerKey | 회원: `user_id`, 비회원: `ANONYMOUS` | SDK v2 필수 파라미터 |

---

## 8. 보안 고려사항

- **금액 위변조 방지**: 결제 요청 전 서버에 `orderId`+`amount` 저장 필수 (v2 공식 권고), 승인 시 DB `entry_fee`와 비교 검증
- **구매자 취소 처리**: `PAY_PROCESS_CANCELED` 시 `orderId` 없음 → null 체크 후 entry PENDING 유지
- **idempotency**: 동일 `orderId`로 중복 결제 방지 (토스 API 자체 지원)
- **시크릿키 보호**: `TOSS_SECRET_KEY`는 서버 Route Handler에서만 사용, 클라이언트 노출 절대 금지
- **웹훅 검증**: 토스 웹훅 서명(HMAC) 검증 (가상계좌 입금 확인 시 필수)
- **CORS**: 결제 API 엔드포인트는 서버 전용 처리
- **결제 승인 시간 제한**: 결제 요청 후 10분 이내 승인 필요 (초과 시 `NOT_FOUND_PAYMENT_SESSION`)

---

## 9. 권한 매트릭스

| 기능 | 비회원 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|--------|------|---------|-------|-------------|
| 참가비 결제 | X | O | O | O | O |
| 내 결제 내역 조회 | X | O | O | O | O |
| 환불 요청 | X | O(본인) | O(본인) | O | O |
| 전체 결제 조회 | X | X | X | O | O |
| 관리자 환불 처리 | X | X | X | O | O |

---

## 10. 구현 순서 (권장)

| 순서 | 작업 | 규모 |
|------|------|------|
| 1 | DB 마이그레이션 (toss_order_id, toss_payment_key 컬럼 추가) | XS |
| 2 | `@tosspayments/tosspayments-sdk` 설치 + 환경변수 설정 | XS |
| 3 | 결제 성공/실패 Route Handler 구현 (`/api/payments/toss/`) | M |
| 4 | `TournamentEntryActionsNew` 결제 버튼 연동 | M |
| 5 | 무료 대회 (entry_fee=0) 즉시 확정 처리 | S |
| 6 | 내 결제 내역 페이지 (`/my/payments`) | M |
| 7 | 관리자 결제/환불 페이지 (`/admin/payments`) | M |
| 8 | 웹훅 처리 (가상계좌) | S |
| 9 | 테스트 환경에서 E2E 결제 플로우 검증 | M |

---

## 11. 성공 지표

- 토스 테스트 카드로 전체 결제 플로우 완료 (신청 → 결제 → 확정)
- 결제 실패 시 재시도 가능
- 금액 위변조 시 결제 승인 거부 확인
- 환불 API 정상 동작 확인
- entry_fee=0 대회는 결제 없이 즉시 확정
