# Design: 토스 페이먼츠 참가비 결제 연동

## 참조 Plan
`docs/01-plan/features/toss-payment.plan.md`

---

## 1. 현재 상태 분석 (As-Is)

### DB 실제 스키마
```sql
-- tournament_entries
payment_status payment_status DEFAULT 'PENDING'  -- ENUM: PENDING | COMPLETED | FAILED | CANCELLED
payment_confirmed_at TIMESTAMPTZ

-- tournaments
entry_fee INTEGER NOT NULL DEFAULT 0
bank_account TEXT  -- 수동 계좌이체용
```

### 코드 불일치 (버그) — 함께 수정 필요
| 위치 | 현재 | 올바른 값 |
|------|------|-----------|
| `entries/actions.ts:152` | `payment_status: 'UNPAID'` | `'PENDING'` |
| `TournamentEntryActionsNew.tsx:275` | `paymentStatus === 'PAID'` | `=== 'COMPLETED'` |
| `TournamentEntryActionsNew.tsx:280` | `"결제 완료"` | 유지 |

### 결론
- DB enum은 `PENDING | COMPLETED | FAILED | CANCELLED` (변경 불필요)
- `PENDING` = 미결제 대기, `COMPLETED` = 결제 완료

---

## 2. 목표 상태 (To-Be)

### 전체 흐름

```
[참가 신청]
사용자 → 참가 신청 폼 제출
       → createEntry() → entry (status: PENDING, payment_status: PENDING)
       → entryFee === 0 이면 → 대회 상세 페이지 (기존 흐름 유지)
       → entryFee > 0 이면  → /tournaments/{id}/payment?entryId={entryId}

[결제]
결제 페이지 → TossPayments SDK 초기화
            → widgets.setAmount({ value: entryFee })
            → widgets.renderPaymentMethods() + widgets.renderAgreement()
            → '결제하기' 버튼 → widgets.requestPayment()
            → 성공: /tournaments/{id}/payment/success?paymentKey=&orderId=&amount=
            → 실패: /tournaments/{id}/payment/fail?code=&message=

[결제 승인] (서버)
success 페이지 로드 → confirmPayment() Server Action
                   → amount 검증 (쿼리파라미터 vs DB entry_fee)
                   → 토스 승인 API 호출 (POST /v1/payments/confirm)
                   → 성공: payment_status = COMPLETED, payment_key = paymentKey, payment_confirmed_at = now
                   → 대회 상세 페이지로 redirect

[취소]
deleteEntry() 호출 전 → payment_status === 'COMPLETED' 이면 cancelTossPayment() 호출
                     → 토스 취소 API (POST /v1/payments/{paymentKey}/cancel)
                     → payment_status = CANCELLED
                     → entry 삭제 진행
```

---

## 3. DB 마이그레이션

```sql
-- 12_add_payment_columns.sql
ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS payment_key TEXT,
  ADD COLUMN IF NOT EXISTS toss_order_id TEXT;

-- 인덱스 (payment_key로 토스 콜백 조회 대비)
CREATE INDEX IF NOT EXISTS idx_tournament_entries_payment_key
  ON tournament_entries(payment_key)
  WHERE payment_key IS NOT NULL;
```

> `payment_status` enum은 변경 없음. `payment_confirmed_at`은 이미 존재.

---

## 4. 환경변수

```bash
# .env.local
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...   # 클라이언트 노출 OK
TOSS_SECRET_KEY=test_sk_...               # 서버 전용, 절대 클라이언트 노출 금지
```

---

## 5. 파일 구조

### 신규 생성

```
src/
├── app/
│   └── tournaments/
│       └── [id]/
│           └── payment/
│               ├── page.tsx          # 결제 페이지 (결제위젯 렌더링)
│               ├── success/
│               │   └── page.tsx      # 결제 성공 콜백 (서버에서 승인 처리)
│               └── fail/
│                   └── page.tsx      # 결제 실패 안내
└── lib/
    └── payment/
        └── actions.ts               # confirmPayment, cancelTossPayment
```

### 수정 파일

```
src/
├── lib/entries/actions.ts            # 'UNPAID' → 'PENDING' 버그 수정
├── components/tournaments/
│   ├── TournamentEntryActionsNew.tsx # 'PAID' → 'COMPLETED' 버그 수정
│   │                                 # createEntry 후 entryFee > 0 시 redirect
│   └── TournamentEntryForm.tsx       # (확인 필요) bankAccount 안내 제거 or 조건부
└── supabase/migrations/
    └── 12_add_payment_columns.sql
```

---

## 6. 컴포넌트 설계

### `app/tournaments/[id]/payment/page.tsx`

```tsx
// Server Component: 권한 체크 + 데이터 조회
// Client Component(TossPaymentWidget)에 props 전달
interface PageProps {
  params: { id: string }
  searchParams: { entryId: string }
}

// 검증:
// 1. 로그인 여부
// 2. entry가 본인 것인지 + tournament_id 일치
// 3. payment_status === 'PENDING' (이미 결제됐으면 redirect)
// 4. entryFee > 0
```

### `components/tournaments/TossPaymentWidget.tsx` (신규 Client Component)

```tsx
'use client'

interface TossPaymentWidgetProps {
  entryId: string
  tournamentId: string
  entryFee: number        // 결제 금액 (원)
  tournamentTitle: string
  orderId: string         // toss-{entryId} 형식
}

// SDK 초기화 → setAmount → renderPaymentMethods + renderAgreement
// requestPayment({ orderId, orderName, successUrl, failUrl })
```

### `app/tournaments/[id]/payment/success/page.tsx`

```tsx
// Server Component (Next.js App Router)
// searchParams: { paymentKey, orderId, amount }
// → confirmPayment() 호출
// → 성공: redirect to /tournaments/{id} with toast query param
// → 실패: 에러 메시지 표시
```

---

## 7. Server Action 설계

### `src/lib/payment/actions.ts`

```ts
'use server'

/** 결제 승인 */
export async function confirmPayment(params: {
  paymentKey: string
  orderId: string      // toss-{entryId} 형식
  amount: number
}): Promise<{ success: boolean; error?: string }>

/** 결제 취소 (참가 취소 시 호출) */
export async function cancelTossPayment(
  entryId: string
): Promise<{ success: boolean; error?: string }>
```

#### `confirmPayment` 처리 순서

```
1. orderId에서 entryId 파싱 ("toss-{entryId}" → entryId)
2. DB에서 entry 조회 (entry.tournament_id, entry.payment_status, tournament.entry_fee)
3. 이미 COMPLETED이면 → early return success (멱등성)
4. amount vs tournament.entry_fee 검증 → 불일치 시 error
5. 토스 승인 API 호출:
   POST https://api.tosspayments.com/v1/payments/confirm
   Authorization: Basic base64(TOSS_SECRET_KEY:)
   { paymentKey, orderId, amount }
6. 응답 status === 'DONE' 확인
7. Admin client로 entry 업데이트:
   payment_status = 'COMPLETED'
   payment_key = paymentKey
   toss_order_id = orderId
   payment_confirmed_at = now
8. revalidatePath
```

#### `cancelTossPayment` 처리 순서

```
1. DB에서 entry 조회 (payment_status, payment_key)
2. payment_status !== 'COMPLETED' → early return (결제 안 된 경우)
3. 토스 취소 API 호출:
   POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
   { cancelReason: "참가 신청 취소" }
4. Admin client로 entry 업데이트:
   payment_status = 'CANCELLED'
```

---

## 8. 기존 `deleteEntry` 수정

```ts
// src/lib/entries/actions.ts - deleteEntry 함수에 추가
// 삭제 전 결제 취소
if (entry.payment_status === 'COMPLETED' && entry.payment_key) {
  const cancelResult = await cancelTossPayment(entryId)
  if (!cancelResult.success) {
    return { success: false, error: `결제 취소 실패: ${cancelResult.error}` }
  }
}
```

---

## 9. orderId 규칙

```
형식: toss-{entryId}
예시: toss-550e8400-e29b-41d4-a716-446655440000

- 토스 orderId 최대 64자 (UUID 36자 + "toss-" 5자 = 41자, OK)
- 영숫자, -, _ 만 허용
- DB entry_id(UUID)는 "-" 포함 → 허용됨
- confirmPayment에서 역파싱: orderId.replace('toss-', '')
```

---

## 10. 에러 처리

| 케이스 | 처리 |
|--------|------|
| 결제 페이지 직접 접근 (인증 없음) | redirect `/auth/login` |
| 타인 entry로 결제 시도 | 403 에러 페이지 |
| 이미 결제 완료된 entry | redirect 대회 상세 |
| amount 불일치 | 승인 거부, 에러 메시지 |
| 토스 승인 API 실패 | 에러 메시지, 재시도 안내 |
| 토스 취소 API 실패 | 에러 반환 (entry 삭제 중단) |
| entryFee === 0인 대회 | payment 페이지 접근 시 redirect 대회 상세 |

---

## 11. UI 흐름 변경 (`TournamentEntryActionsNew.tsx`)

```tsx
// handleSubmit 수정
const handleSubmit = async (data: EntryFormData) => {
  const result = await createEntry(tournamentId, data)

  if (result.success && result.entryId) {
    setShowEntryForm(false)

    if (entryFee > 0) {
      // 결제 페이지로 이동
      router.push(`/tournaments/${tournamentId}/payment?entryId=${result.entryId}`)
    } else {
      // 참가비 없는 대회 → 기존 흐름
      getUserEntry(tournamentId).then(...)
    }
  }
  return result
}
```

---

## 12. SDK 설치

```bash
npm install @tosspayments/tosspayments-sdk
```

---

## 13. 구현 순서

1. **DB 마이그레이션** — `12_add_payment_columns.sql` 실행
2. **버그 수정** — `UNPAID` → `PENDING`, `PAID` → `COMPLETED`
3. **환경변수 추가** — `.env.local`에 토스 키 추가
4. **SDK 설치** — `npm install @tosspayments/tosspayments-sdk`
5. **`src/lib/payment/actions.ts`** — confirmPayment, cancelTossPayment 구현
6. **`deleteEntry` 수정** — 결제 취소 로직 추가
7. **결제 페이지** — `payment/page.tsx` + `TossPaymentWidget.tsx`
8. **성공/실패 페이지** — `payment/success/page.tsx`, `payment/fail/page.tsx`
9. **`TournamentEntryActionsNew.tsx` 수정** — 결제 페이지 redirect 로직
10. **테스트** — 샌드박스 키로 전체 흐름 검증
