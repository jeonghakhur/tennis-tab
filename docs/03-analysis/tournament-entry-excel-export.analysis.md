# tournament-entry-excel-export Gap Analysis Report

> **Analysis Type**: Gap Analysis (Plan vs Implementation)
>
> **Project**: tennis-tab
> **Analyst**: gap-detector
> **Date**: 2026-04-01
> **Plan Doc**: [tournament-entry-excel-export.plan.md](../01-plan/features/tournament-entry-excel-export.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Plan 문서(Design 문서 없음)와 실제 구현 코드 간의 일치율을 측정하고 차이점을 도출한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/tournament-entry-excel-export.plan.md`
- **Implementation Files**:
  - `src/app/api/admin/tournaments/[id]/entries/export/route.ts` (172 lines)
  - `src/components/admin/EntriesManager.tsx` (lines 336-374: handleExcelDownload, lines 689-697: button)

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | ✅ |
| Architecture Compliance | 100% | ✅ |
| Convention Compliance | 100% | ✅ |
| **Overall** | **100%** | ✅ |

---

## 3. Gap Analysis (Plan vs Implementation)

### 3.1 Verification Checklist

| # | Plan Item | Implementation Location | Status |
|---|-----------|------------------------|--------|
| 1 | Auth: MANAGER+ via `canManageTournaments(role)` | route.ts:45 | ✅ Match |
| 2 | Ownership: MANAGER can only access own tournaments | route.ts:61-63 | ✅ Match |
| 3 | ADMIN/SUPER_ADMIN can access all | route.ts:61 | ✅ Match |
| 4 | Phone decryption via `decryptProfile()` | route.ts:83-86 | ✅ Match |
| 5 | Doubles: `partner_data` columns (파트너, 파트너 클럽) | route.ts:106-109 | ✅ Match |
| 6 | Team match: `team_members[i].name` → 팀원1~N | route.ts:113-117 | ✅ Match |
| 7 | `ENTRY_STATUS_LABELS` Korean mapping | route.ts:12-19 | ✅ Match |
| 8 | `PAYMENT_STATUS_LABELS` Korean mapping | route.ts:21-26 | ✅ Match |
| 9 | Filename: `{대회명}_참가신청내역_{YYYYMMDD}.xlsx` | route.ts:155 | ✅ Match |
| 10 | Content-Disposition: `filename*=UTF-8''` | route.ts:160 | ✅ Match |
| 11 | Content-Type: xlsx MIME type | route.ts:159 | ✅ Match |
| 12 | Column order (순번~입금자명) | route.ts:95-128 | ✅ Match |
| 13 | Query: entries + profiles JOIN + divisions JOIN | route.ts:67-76 | ✅ Match |
| 14 | ORDER BY created_at ASC, id ASC | route.ts:75-76 | ✅ Match |
| 15 | 신청자명 fallback: player_name → profiles.name | route.ts:99 | ✅ Match |
| 16 | 전화번호 fallback: phone → profiles.phone | route.ts:101 | ✅ Match |
| 17 | 클럽 fallback: club_name → profiles.club | route.ts:102 | ✅ Match |
| 18 | 입금자명: 값 있을 때만 추가 | route.ts:124-127 | ✅ Match |
| 19 | Endpoint: GET /api/admin/tournaments/[id]/entries/export | route.ts path + L28 | ✅ Match |
| 20 | xlsx library: SheetJS | route.ts:5 | ✅ Match |
| 21 | Client: fetch → blob → anchor download | EntriesManager:336-362 | ✅ Match |
| 22 | Client: Content-Disposition filename* parsing | EntriesManager:352-354 | ✅ Match |
| 23 | Client: Download icon + excelDownloading disabled | EntriesManager:689-696 | ✅ Match |
| 24 | Client: error handling (AlertDialog) | EntriesManager:341-347, 364-370 | ✅ Match |
| 25 | 신청일 format YYYY-MM-DD | route.ts:97 + formatDate:165-171 | ✅ Match |

**25/25 items match (100%)**

### 3.2 Missing Features (Plan O, Implementation X)

없음.

### 3.3 Added Features (Plan X, Implementation O)

| # | Item | Location | Impact |
|---|------|----------|--------|
| 1 | Column auto-width calculation (한글 2바이트 근사) | route.ts:136-145 | UX 개선 |
| 2 | Sheet name '참가신청내역' | route.ts:147 | 가독성 개선 |
| 3 | Filename 특수문자 sanitization | route.ts:154 | 안정성 개선 |
| 4 | 401/403/404/500 한국어 에러 메시지 | route.ts:35-36, 46, 63, 79 | 표준 패턴 |

모두 plan에 명시되지 않았지만 당연히 필요한 구현 사항으로, gap이 아닌 개선사항.

### 3.4 Changed Features (Plan != Implementation)

없음. 모든 항목이 plan 명세와 정확히 일치.

---

## 4. Observations (Gap은 아니나 참고)

| # | Observation | Location | Note |
|---|-------------|----------|------|
| 1 | `refund_holder` 컬럼이 migration 파일에 없음 | route.ts:124 | DB에 직접 추가된 것으로 추정. `as Record<string, unknown>` 캐스팅으로 안전 처리. migration 파일 추가 권장 |
| 2 | entries 0건일 때 헤더 없는 빈 xlsx 생성 | route.ts:134 | `json_to_sheet([])` 호출 시 컬럼 헤더도 없음. 빈 대회에서 다운로드 시 빈 파일 생성됨 |

---

## 5. Match Rate Summary

```
+-------------------------------------------------+
|  Overall Match Rate: 100%                       |
+-------------------------------------------------+
|  Plan items checked:     25                     |
|  Match:                  25 (100%)              |
|  Missing (Plan O):        0 (0%)                |
|  Changed (Plan != Impl):  0 (0%)                |
|  Added (Plan X):          4 (all improvements)  |
+-------------------------------------------------+
```

---

## 6. Recommended Actions

없음. 구현이 Plan과 완벽히 일치한다.

### 선택적 개선사항
1. `refund_holder` 등 환불 관련 컬럼에 대한 migration 파일 추가 (DB 형상관리 정합성)
2. entries 0건일 때 헤더만 있는 빈 시트 생성 처리 고려

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-01 | Initial analysis | gap-detector |
