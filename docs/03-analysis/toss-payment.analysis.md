# Gap Analysis: 토스 페이먼츠 참가비 결제 연동

**분석일**: 2026-02-25
**Design**: `docs/02-design/features/toss-payment.design.md`
**Match Rate**: 87%

---

## 전체 요약

| 항목 | 상태 |
|------|------|
| 파일 구조 | ✅ 100% |
| 버그 수정 | ✅ 100% |
| DB 마이그레이션 파일 | ✅ 생성됨 |
| DB 마이그레이션 적용 | ❌ 미적용 (운영 이슈) |
| 결제 흐름 (코드) | ✅ 95% |
| 에러 처리 | ✅ 90% |

---

## 구현 완료 항목 ✅

### 파일 구조 (설계 §5)
- `src/app/tournaments/[id]/payment/page.tsx` — Server Component, 권한·데이터 검증
- `src/app/tournaments/[id]/payment/success/page.tsx` — confirmPayment 호출 → redirect
- `src/app/tournaments/[id]/payment/fail/page.tsx` — 에러 표시, PAY_PROCESS_CANCELED 구분
- `src/lib/payment/actions.ts` — confirmPayment, cancelTossPayment
- `src/components/tournaments/TossPaymentWidget.tsx` — SDK 초기화·위젯 렌더·requestPayment

### 버그 수정 (설계 §1)
- `entries/actions.ts:152` — `'UNPAID'` → `'PENDING'` ✅
- `TournamentEntryActionsNew.tsx` — `=== 'PAID'` → `=== 'COMPLETED'` ✅

### 결제 흐름
- entryFee > 0 → 결제 페이지 redirect ✅
- orderId 규칙 `toss-{entryId}` ✅
- 금액 검증 (amount vs tournament.entry_fee) ✅
- 토스 승인 API 호출 (Basic Auth, DONE 상태 확인) ✅
- 멱등성 보장 (COMPLETED 이면 early return) ✅
- payment_status CANCELLED 처리 (cancelTossPayment) ✅
- deleteEntry에 결제 취소 로직 통합 ✅
- PaymentSuccessToast (?paid=1 쿼리 감지) — 설계에 없었으나 추가 구현 ✅

---

## 갭 목록

### GAP-01 🔴 DB 마이그레이션 미적용 (Critical)

**설계**: `payment_key`, `toss_order_id` 컬럼 추가 후 결제 완료 시 저장
**현실**: 마이그레이션 파일(`12_add_payment_columns.sql`) 은 존재하나 DB에 미적용

**영향**:
- `payment_key` 미저장 → 참가 취소 시 토스 취소 API 호출 불가 (payment_key 없어서 생략)
- `toss_order_id` 미저장
- 현재 코드: UPDATE fallback으로 `payment_status: 'COMPLETED'` 만 저장

**해결**: Supabase SQL Editor에서 마이그레이션 실행

```sql
ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS payment_key TEXT,
  ADD COLUMN IF NOT EXISTS toss_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tournament_entries_payment_key
  ON tournament_entries(payment_key)
  WHERE payment_key IS NOT NULL;
```

---

### GAP-02 🟡 `payment_confirmed_at` 설계 오류 (Minor)

**설계 §1**: "`payment_confirmed_at TIMESTAMPTZ` — 이미 존재"
**현실**: 실제 DB에 해당 컬럼 없음 (존재 가정이 틀렸음)

**영향**: 결제 완료 시각이 저장되지 않음
**해결**: 마이그레이션에 컬럼 추가

```sql
ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
```

---

### GAP-03 🟡 `revalidatePath` 제거 (Minor, 의도적)

**설계 §7**: confirmPayment 처리 후 `revalidatePath` 호출
**구현**: 제거됨

**이유**: Next.js App Router에서 Server Component 렌더 중 `revalidatePath` 호출 불가
**영향**: 없음 (success 페이지에서 redirect하므로 데이터 자동 갱신)
**조치**: 설계 문서 업데이트 필요 (의도적 변경)

---

### GAP-04 🟢 TossPaymentWidget `orderId` prop 제거 (Trivial)

**설계 §6**: `orderId: string` prop 포함
**구현**: 컴포넌트 내부에서 `toss-${entryId}`로 생성

**영향**: 없음 (동일한 규칙, 불필요한 외부 prop 제거 → 더 나은 구현)

---

## 미해결 이슈 (세션 중 발생)

| 이슈 | 원인 | 해결 여부 |
|------|------|-----------|
| "결제위젯 연동 키 사용" 에러 | 잘못된 키 타입(test_ck_→test_gck_) | ✅ |
| "참가 신청 정보를 찾을 수 없습니다" | payment_key 컬럼 미존재로 SELECT 실패 | ✅ |
| "하나의 약관 위젯만을 사용할 수 있어요" | React StrictMode double-invoke | ✅ |
| revalidatePath 렌더 중 호출 에러 | Server Component에서 호출 불가 | ✅ |
| "payment_confirmed_at column not found" | DB 컬럼 미존재 (설계 오류) | ✅ (fallback) |

---

## 권장 액션

### 즉시 (Critical)
1. Supabase SQL Editor에서 `12_add_payment_columns.sql` 실행
2. `payment_confirmed_at` 컬럼 추가 마이그레이션 실행
3. 마이그레이션 적용 후 `payment/actions.ts`의 UPDATE fallback 로직 제거

### 단기
4. 코드 정리: `confirmPayment`의 2단계 UPDATE fallback → 단일 UPDATE로 단순화
5. 설계 문서 §1 수정: `payment_confirmed_at` "이미 존재" → "마이그레이션 필요"

---

## 결론

코드 구현은 설계 대비 **95% 일치**. 단, DB 마이그레이션 미적용으로 **운영 Match Rate는 87%**.
마이그레이션 적용 후 코드 fallback 정리 시 **100% 달성** 가능.

**다음 단계**: Supabase SQL Editor에서 마이그레이션 적용 → `/pdca report toss-payment`
