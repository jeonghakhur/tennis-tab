# Admin Tournament Delete - Gap Analysis Report

> **Analysis Type**: Implementation Quality / Convention Compliance / Security Review
>
> **Project**: tennis-tab
> **Analyst**: Claude (gap-detector)
> **Date**: 2026-02-25
> **Target Files**:
>   - `src/lib/tournaments/actions.ts` (deleteTournament Server Action)
>   - `src/components/admin/TournamentsTable.tsx` (UI)
>   - `src/app/admin/tournaments/page.tsx` (Page)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Admin 대회 삭제 기능의 구현 품질, 보안, 접근성, 프로젝트 컨벤션 준수 여부를 분석한다.
별도 Design 문서 없이 구현된 기능이므로, 프로젝트 전반의 패턴 및 CLAUDE.md 규칙을 기준으로 비교한다.

### 1.2 Analysis Scope

- Server Action: 권한 체크, 입력 검증, 에러 처리, 보안
- UI: 접근성, 컨벤션, UX 패턴 일관성
- 기존 코드와의 패턴 일관성

---

## 2. Gap Analysis

### 2.1 Security Issues

| Severity | File | Location | Issue | Recommendation |
|----------|------|----------|-------|----------------|
| **CRITICAL** | actions.ts | L459 | Fallback Service Role Key 하드코딩 (`sb_secret_...`) | `createAdminClient()` from `@/lib/supabase/admin` 사용으로 교체 |
| **HIGH** | actions.ts | L422-489 | `tournamentId` 입력값 UUID 검증 없음 | 다른 actions 파일처럼 `validateId()` 패턴 적용 필요 |

**Details - Fallback Key**:
`src/lib/tournaments/actions.ts`는 프로젝트 내 유일하게 `@supabase/supabase-js`에서 직접 `createClient`를 import하여 Admin 클라이언트를 생성한다. 다른 모든 Server Action 파일(`bracket`, `clubs`, `community`, `entries`, `auth`, `support`, `faq`, `payment`, `storage`, `associations`)은 `@/lib/supabase/admin`의 `createAdminClient()`를 사용하며, 이 함수는 환경변수 미설정 시 throw한다 (CLAUDE.md 규칙 준수).

현재 `deleteTournament`뿐 아니라 `createTournament`, `updateTournament`, `closeTournament`, `updateTournamentStatus` 모두 동일한 fallback 키 패턴을 사용한다 (L126, L298, L459, L530). 이는 CLAUDE.md의 "환경변수 미설정 시 throw (fallback 키 금지)" 규칙을 위반한다.

**Details - ID Validation**:
`src/lib/bracket/actions.ts`, `src/lib/clubs/actions.ts`, `src/lib/community/actions.ts` 등 다른 Server Actions는 모두 `validateId()` 함수로 UUID 형식 검증을 수행한다. `deleteTournament`는 `tournamentId`를 검증 없이 DB 쿼리에 직접 사용한다.

### 2.2 Permission Model

| Item | Design Intent | Implementation | Status | Notes |
|------|---------------|----------------|--------|-------|
| SUPER_ADMIN 삭제 | 모든 대회 삭제 가능 | L450: `['ADMIN', 'SUPER_ADMIN'].includes(...)` | Match | |
| ADMIN 삭제 | 모든 대회 삭제 가능 | L450 | Match | |
| MANAGER 삭제 | 자기 대회만 삭제 가능 | L452: `tournament.organizer_id !== user.id` | Match | organizer_id로 확인 |
| USER/RESTRICTED | 삭제 불가 | L452 | Match | isAdminOrHigher=false + organizer 아님 |
| UI 삭제 버튼 노출 | MANAGER 이상에게 표시 | page.tsx L63: `showDelete` 무조건 전달 | Match | 페이지 접근 자체가 canManageTournaments 게이트 |

권한 모델은 올바르게 구현되어 있다. 서버 사이드에서 ADMIN+이거나 organizer인지 확인하며, 페이지 접근 자체가 MANAGER 이상으로 제한된다.

단, **MANAGER가 타인의 대회 삭제 버튼을 볼 수 있다**는 점은 UX 이슈이다. `isAdminOrHigher`가 false인 경우 `query.eq('organizer_id', user.id)`로 자기 대회만 로드하므로 실제로는 문제 없지만, 명시적으로 확인할 필요가 있다.

### 2.3 Convention Compliance

| Category | Convention | Implementation | Status | Violation |
|----------|-----------|----------------|--------|-----------|
| Admin Client | `@/lib/supabase/admin` 사용 | `@supabase/supabase-js` 직접 import | VIOLATION | 전체 파일에서 패턴 불일치 |
| ID Validation | `validateId()` 패턴 | 검증 없음 | VIOLATION | UUID 검증 누락 |
| Error Pattern | `{ success, error }` 반환 | `{ success, error }` | Match | |
| Naming | camelCase 함수명 | `deleteTournament` | Match | |
| Component File | PascalCase.tsx | `TournamentsTable.tsx` | Match | |
| Import Order | external -> internal -> relative -> type | 올바름 | Match | |
| revalidatePath | 변경 관련 경로 | `/tournaments`, `/admin/tournaments` | Match | |

### 2.4 UI/Accessibility

| Item | CLAUDE.md Rule | Implementation | Status | Notes |
|------|----------------|----------------|--------|-------|
| 삭제 버튼 | `<button>` 사용 필수 | `<button type="button">` | Match | |
| aria-label | 인터랙티브 요소에 필수 | `aria-label={\`${tournament.title} 삭제\`}` | Match | 대회명 포함하여 스크린 리더 지원 |
| ConfirmDialog | Modal 사용 패턴 | `ConfirmDialog` 사용 | Match | 프로젝트 패턴 준수 |
| Toast | 성공/실패 피드백 | `Toast` 사용 | Match | |
| isLoading | 중복 클릭 방지 | `isDeleting` 상태 + `isLoading` prop | Match | |
| 모바일 삭제 | 반응형 지원 | 모바일 카드 뷰에서 삭제 버튼 없음 | GAP | 모바일에서는 삭제 불가 |
| 관리 열 헤더 | 접근성 | `aria-label="관리"` 빈 `<th>` | Match | |

### 2.5 Edge Cases

| Scenario | Handling | Status | Notes |
|----------|----------|--------|-------|
| 이미 삭제된 대회 | Supabase `.single()` → 404 에러 | Partial | "대회를 찾을 수 없습니다" 메시지 반환 |
| 네트워크 에러 | try-finally 패턴 | Match | `setIsDeleting(false)` + `setDeleteTarget(null)` |
| Storage 삭제 실패 | catch로 무시 | Match | DB 삭제 성공이 우선, Storage 실패는 무시 |
| poster_url 없는 대회 | `if (tournament.poster_url)` 체크 | Match | |
| poster_url 잘못된 URL | `new URL()` try-catch | Match | catch 블록에서 무시 |
| 동시 삭제 시도 | 서버 사이드 DB 쿼리 | Partial | `.eq('id', tournamentId)` 삭제 시 이미 없으면 에러 없이 0행 삭제됨 — deleteError가 발생하지 않아 success 반환 가능 |

### 2.6 Existing TournamentActions.tsx vs New Admin Delete

기존 `src/components/tournaments/TournamentActions.tsx`에도 `deleteTournament`를 사용하는 삭제 기능이 있다.

| Aspect | TournamentActions (기존) | TournamentsTable (신규) | Notes |
|--------|-------------------------|------------------------|-------|
| 확인 다이얼로그 | 직접 div 모달 구현 | `ConfirmDialog` 컴포넌트 | 기존 코드가 컨벤션 위반 |
| 에러 피드백 | `AlertDialog` | `Toast` | 다른 패턴 사용 |
| 접근성 | role/aria 없음, 키보드 접근 불가 | `ConfirmDialog`가 처리 | 기존 코드에 접근성 이슈 |
| 대회명 표시 | 없음 | 대회명 포함 확인 메시지 | 신규가 더 나은 UX |

---

## 3. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Security | 60% | FAIL |
| Convention Compliance | 70% | WARNING |
| Accessibility | 90% | PASS |
| Error Handling | 85% | PASS |
| **Overall** | **76%** | WARNING |

---

## 4. Issue Summary

### CRITICAL - Immediate Action Required

| # | Issue | File:Line | Description |
|---|-------|-----------|-------------|
| 1 | Hardcoded Service Role Key | `actions.ts:459` | `sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3` fallback. `createAdminClient()` from `@/lib/supabase/admin`으로 교체 필요 |
| 2 | Hardcoded Key (동일 이슈, 다른 함수) | `actions.ts:126,298,530` | 파일 전체 4곳에서 동일 패턴. 일괄 수정 필요 |

### HIGH - ID Validation Missing

| # | Issue | File:Line | Description |
|---|-------|-----------|-------------|
| 3 | tournamentId UUID 검증 없음 | `actions.ts:422` | `validateId(tournamentId, '대회 ID')` 추가 필요 |
| 4 | createTournament/updateTournament도 동일 | `actions.ts:55,225` | 기존 함수도 검증 누락 (이번 스코프 밖이지만 참고) |

### MEDIUM - UX/Consistency

| # | Issue | File:Line | Description |
|---|-------|-----------|-------------|
| 5 | 모바일 뷰에서 삭제 버튼 없음 | `TournamentsTable.tsx:400-420` | `sm:hidden` 모바일 카드 뷰에 삭제 기능 미제공 |
| 6 | 동시 삭제 시 false positive | `actions.ts:465-468` | 이미 삭제된 대회를 삭제하면 에러 없이 `{ success: true }` 반환 |
| 7 | 기존 TournamentActions.tsx 접근성 이슈 | `TournamentActions.tsx:77-104` | 직접 구현한 모달에 role/aria 없음, ESC 키 미지원 |

### LOW - Style/Improvement

| # | Issue | File:Line | Description |
|---|-------|-----------|-------------|
| 8 | Storage 정리 시 bucket 이름 하드코딩 | `actions.ts:480` | `'tournaments'` 문자열. 상수화 권장 |

---

## 5. Recommended Actions

### 5.1 Immediate (CRITICAL/HIGH 수정)

1. **`actions.ts` 전체: `createAdminClient` import 교체**
   - `import { createClient as createAdminClient } from '@supabase/supabase-js'` 제거
   - `import { createAdminClient } from '@/lib/supabase/admin'` 추가
   - 4곳의 inline `createAdminClient(url, key)` 호출을 `createAdminClient()`로 교체

2. **`deleteTournament`에 `validateId` 추가**
   - 기존 프로젝트 패턴: `if (!id || typeof id !== 'string' || id.length < 10)` 형태
   - `tournaments/actions.ts` 파일 상단에 `validateId` 함수 추가 또는 공용 유틸에서 import

### 5.2 Short-term (MEDIUM)

3. **모바일 뷰 삭제 버튼 추가** 또는 모바일에서도 테이블 뷰 사용
4. **동시 삭제 방어**: 삭제 후 affected rows 확인 (Supabase는 `.select()` 체인으로 확인 가능)
5. **TournamentActions.tsx의 모달을 `ConfirmDialog`로 교체** (별도 리팩터링 태스크)

---

## 6. Convention Score Detail

```
Convention Compliance: 70%

  Admin Client Pattern:    0% (1/1 violation - @supabase/supabase-js 직접 사용)
  ID Validation:           0% (1/1 violation - validateId 미사용)
  Error Return Pattern:  100% (success/error 패턴 준수)
  Naming Convention:     100% (camelCase, PascalCase 준수)
  Component Pattern:     100% (ConfirmDialog, Toast 사용)
  Accessibility:          90% (aria-label 있음, 모바일 뷰만 누락)
  Import Order:          100% (external -> internal 순서 준수)
```

---

## 7. Positive Findings

구현에서 잘된 부분도 기록한다.

1. **DB CASCADE 활용**: 수동으로 하위 테이블을 삭제하지 않고 DB CASCADE에 의존. 원자적이고 안전함.
2. **Storage 정리 분리**: DB 삭제 성공 후 Storage 정리를 시도하되, 실패해도 무시. 올바른 우선순위.
3. **ConfirmDialog 사용**: 프로젝트 표준 컴포넌트 사용, 대회명 포함 메시지로 UX 명확.
4. **삭제 후 갱신**: `router.refresh()` + `revalidatePath` 양쪽 모두 처리.
5. **isLoading 상태**: 중복 클릭 방지 및 로딩 UI 제공.
6. **권한 모델**: 서버 사이드에서 이중 확인 (organizer OR ADMIN+).
7. **aria-label에 대회명 포함**: 스크린 리더에서 어떤 대회의 삭제 버튼인지 식별 가능.

---

## 8. Next Steps

- [ ] CRITICAL 이슈 2건 수정 (fallback key 제거)
- [ ] HIGH 이슈 1건 수정 (validateId 추가)
- [ ] MEDIUM 이슈 검토 후 백로그 등록

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-25 | Initial analysis | Claude (gap-detector) |
