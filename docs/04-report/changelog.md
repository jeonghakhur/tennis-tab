# Changelog

All notable changes to the Tennis-Tab project are documented here.

## [2026-03-05] - Bracket Active Round Management Complete

### Added
- `useBracketConfigRealtime` hook (`src/lib/realtime/useBracketConfigRealtime.ts`) for real-time bracket config updates
- `setActiveRound()` server action to toggle active phase/round for tournament divisions
- Active phase and round toggle buttons in admin BracketManager (PreliminaryTab, MainBracketTab)
- Per-match `isInProgress` calculation in participant my-page (`src/app/my/profile/page.tsx`)
- "In Progress"/"Upcoming" badge real-time reflection on participant dashboard
- Explicit "Submit Score" button with aria-label in BracketView and my-page

### Changed
- DB schema: `bracket_configs` table now includes `active_phase` and `active_round` columns
- `BracketConfig` interface: added active_phase (TEXT | NULL) and active_round (INT | NULL) fields
- Realtime Publication: `bracket_configs` table registered for UPDATE events with REPLICA IDENTITY FULL
- Admin UI: PreliminaryTab now displays play/pause toggle for preliminary phase
- Admin UI: MainBracketTab now displays per-round toggle buttons with active status badge
- Participant UX: Match cards now show real-time status synchronization from admin toggles (< 100ms latency)
- BracketView: `canSubmitScore` calculation now uses `isMatchInProgress()` based on active_phase/active_round
- Server action: `updateBracketConfig()` now handles optimistic updates with field-level rollback on failure

### Security
- Mandatory auth check: `checkBracketManagementAuth()` in `setActiveRound` (MANAGER role minimum)
- Input validation: `validateId(configId)` and `validateNonNegativeInteger(round)`
- Tournament closure check: cannot modify bracket if tournament is COMPLETED or CANCELLED
- Error handling: all mutation failures return structured error objects, no silent failures

### Performance
- Realtime latency: < 100ms from admin toggle to participant screen update
- Instance management: `useRef(createClient())` ensures single Supabase client per hook lifecycle
- Optimistic updates: UI responds immediately, selective field rollback on server failure
- Re-subscription prevention: `idsKey` string-based deps tracking (prevents array reference churn)

### Testing
- Gap analysis: 100% design match rate (Design vs Implementation alignment)
- Code review: 8 issues found and fixed (Critical: 2, Important: 6)
  - Auth result validation, optimistic update strategy, input validation, instance consistency
  - useCallback dependency tracking, configIds array deps replacement, field-level rollback
  - aria-label accessibility enhancement
- Match coverage: 11/11 design items implemented (100%)

### Documentation
- Completion report: `docs/04-report/features/bracket.report.md`
- Implementation map: 7 files modified, 260 LOC added, 430 LOC changed
- Code review log: 2 rounds, 8 issues, 30 min average per round

### Breaking Changes
- None — feature is additive, backward compatible with existing bracket operations

### Known Limitations
- Single active round at a time (future: support multiple active rounds via array)
- No scheduled activation (future: `active_at`, `inactive_at` timestamps)
- No activation history log (future: audit table for compliance tracking)

---

## [2026-02-27] - Member Data Encryption Complete

### Added
- AES-256-GCM encryption for sensitive profile fields (`phone`, `birth_year`, `gender`)
- Crypto utility modules: `src/lib/crypto/encryption.ts` (core AES-256-GCM) and `src/lib/crypto/profileCrypto.ts` (domain wrapper)
- Migration script: `scripts/migrate-encrypt-profiles.ts` for batch encryption of existing data (129 profiles migrated)
- Comprehensive unit tests: 25 test cases covering encrypt/decrypt/isEncrypted patterns
- Post-implementation fix: Admin users page now decrypts encrypted fields before display

### Changed
- `src/lib/auth/actions.ts`: `updateProfile()` now encrypts phone/birth_year/gender before saving
- `src/lib/auth/actions.ts`: `getCurrentUser()` now decrypts sensitive fields after retrieval
- `src/lib/chat/entryFlow/queries.ts`: `getUserProfile()` now decrypts phone for entry flow pre-fill
- `src/app/admin/users/page.tsx`: Added decryptProfile wrapper for proper encryption handling

### Encryption Details
- Algorithm: AES-256-GCM (authenticated encryption, 256-bit key)
- Format: `{iv_hex}:{authTag_hex}:{ciphertext_hex}` (16B IV + 16B auth tag)
- IV generation: random 16 bytes per encryption (no pattern analysis possible)
- Compatibility: `isEncrypted()` check for gradual migration (plaintext/ciphertext coexistence)

### Database
- No schema changes required (stored in existing text columns)
- Migration: 129 profiles encrypted across 2 passes (offset pagination row shift handling)
- Idempotent: `isEncrypted()` prevents re-encryption of already encrypted data
- Rollback: Safe due to plaintext/ciphertext coexistence via isEncrypted() pattern

### Security
- ENCRYPTION_KEY stored in environment variables (server-only, no fallback)
- Server startup fails if ENCRYPTION_KEY is missing (enforced on demand)
- authTag validation prevents tampering detection (GCM mode)
- Excluded fields: gender (DB constraint), email (auth sync), name (search), club_* (low sensitivity)

### Testing
- Design match rate: 93% (54/58 items, threshold >= 90% passed)
- Unit test coverage: encryption.test.ts (16 tests) + profileCrypto.test.ts (9 tests)
- Gap analysis completed: `docs/03-analysis/member-data-encryption.analysis.md`
- All critical paths tested (encrypt/decrypt roundtrip, isEncrypted boundaries, error scenarios)

### Documentation
- Plan document: `docs/01-plan/features/member-data-encryption.plan.md`
- Design document: `docs/02-design/features/member-data-encryption.design.md`
- Analysis report: `docs/03-analysis/member-data-encryption.analysis.md`
- Completion report: `docs/04-report/features/member-data-encryption.report.md`

### Known Limitations
- `.env.example` not updated yet (recommended in next PR)
- decrypt() lacks try-catch for corrupted data (existing service exception acceptable during migration)
- tournament_entries.phone not encrypted (separate scope, may require future enhancement)
- Searchable encryption not implemented (deterministic hashing deferred)

### PDCA Status
- Plan ✅, Design ✅, Do ✅, Check ✅ (93% match), Act ✅ (admin page fix)
- Ready for production deployment with environment variable setup

---

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
