# Changelog

All notable changes to the Tennis-Tab project are documented here.

## [2026-02-25] - Toss Payments Integration Complete

### Added
- Toss Payments SDK integration (`@tosspayments/tosspayments-sdk` v2)
- Online payment flow for tournament entries with entry fees
- Payment pages: entry, success, and failure pages
- `TossPaymentWidget` client component for payment UI rendering
- `confirmPayment` and `cancelTossPayment` server actions
- Payment status tracking: PENDING → COMPLETED → CANCELLED
- Automatic refund on entry cancellation
- `PaymentSuccessToast` component for payment completion notification

### Changed
- Tournament entry flow: redirects to payment page when `entryFee > 0`
- `payment_status` enum values: `UNPAID` → `PENDING`, `PAID` → `COMPLETED`
- `TournamentEntryActionsNew.tsx`: added payment page redirect logic
- `deleteEntry` action: integrated payment cancellation before entry deletion

### Fixed
- Bug: `UNPAID` → `PENDING` in `src/lib/entries/actions.ts` (line 152)
- Bug: `PAID` → `COMPLETED` in `TournamentEntryActionsNew.tsx` (line 275)
- React StrictMode double-invoke issue in TossPaymentWidget (cancellation flag)
- revalidatePath error: moved from Server Action to Route Handler

### Database
- Added migration: `12_add_payment_columns.sql`
  - `payment_key TEXT`: Toss paymentKey for cancellation
  - `toss_order_id TEXT`: Toss orderId (`toss-{entryId}` format)
  - `payment_confirmed_at TIMESTAMPTZ`: Payment completion timestamp
  - Index on `payment_key` for efficient lookup

### Security
- `TOSS_SECRET_KEY` enforced as server-only (not exposed to client)
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` for public SDK initialization
- Payment amount validation (DB entry_fee vs query parameter)
- User authorization check (entry ownership verification)
- orderId format validation (`toss-` prefix required)

### Testing
- Gap analysis: 87% → 100% design match rate
- All design requirements fulfilled
- Error handling for 10 critical scenarios
- Sandbox environment testing completed

---

## Document Structure

Each PDCA cycle generates:
- **Plan**: `docs/01-plan/features/{feature}.plan.md`
- **Design**: `docs/02-design/features/{feature}.design.md`
- **Analysis**: `docs/03-analysis/{feature}.analysis.md`
- **Report**: `docs/04-report/features/{feature}.report.md`

## Release History

- **v1.0.0** (2026-02-25): Toss Payments integration complete
  - Feature completion report: `docs/04-report/features/toss-payment.report.md`
  - Match rate: 100%
  - All PDCA phases complete
