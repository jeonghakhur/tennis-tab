# Design: 협회 재정 관리 (Finance Ledger)

> Plan: `docs/01-plan/features/finance-ledger.plan.md` · 구현: 2026-09-09 (Phase 1 + Phase 2)

## 모듈 구조

```
src/lib/finance/
├── types.ts          # 도메인 타입 (Account/Category/Transaction/Ledger/Budget/Matrix)
├── ledger.ts         # 순수 계산: KST 월 경계, 누적 잔액, 분류 소계, 월별 합계, 달성률
├── excelImport.ts    # 결산서 엑셀 파서 (순수, 브라우저/서버 공용)
├── actions.ts        # Server Actions (SUPER_ADMIN 전용) — 계정/분류/거래/원장/연간요약/매트릭스/예산/별칭/가져오기
├── pageAuth.ts       # 페이지 인증 헬퍼 (getVerifiedUser + role ≥ ADMIN)
└── __tests__/        # ledger·validation·excelImport (실데이터 대조 포함)

src/app/admin/finance/
├── page.tsx                 # 연간 대시보드 (계정 카드·월별 수지·분류 합계·예산 달성률)
├── [accountId]/page.tsx     # 월별 원장
├── clubs/page.tsx           # 클럽 납부 매트릭스 (코트비 / 발전기금)
├── import/page.tsx          # 엑셀 가져오기 위저드
└── settings/page.tsx        # 통장·분류·별칭·예산

src/app/api/admin/finance/
├── import/parse/route.ts    # POST 엑셀 → ParseResult (DB 미반영)
└── export/route.ts          # GET 연간 결산서 xlsx

src/components/finance/
├── FinanceOverview.tsx, LedgerManager.tsx, TransactionForm.tsx, ClubCombobox.tsx
├── ClubPaymentMatrix.tsx, ImportWizard.tsx, FinanceSettings.tsx
└── settings/{Account,Category,ClubCourt,Alias,Budget}Settings.tsx
```

## 데이터 모델 (60_finance_ledger.sql)

| 테이블 | 역할 | 핵심 제약 |
|--------|------|-----------|
| `finance_accounts` | 통장(계정): 위탁/협회/이사회비 | `opening_balance`, `opening_date`, name UNIQUE |
| `finance_categories` | 계정별 수입/지출 분류 | UNIQUE(account_id, kind, name), 비활성화로 보존 |
| `finance_transactions` | 거래 원장 | amount > 0, 방향은 category.kind, `import_key` UNIQUE, club_id/tournament_id 선택 |
| `finance_club_aliases` | 엑셀 약칭 → 클럽 | alias PK |
| `finance_budgets` | 연간 운영계획 | UNIQUE(year, account_id, label), `category_ids[]`로 실적 집계 |
| `clubs.court_slot` | 코트 시간대 그룹 | 매트릭스 그룹핑, `COURT_SLOTS` 중 하나. 재정 설정(클럽 코트 설정)에서 입력 |
| `clubs.monthly_court_fee` | 월 코트비 기준 금액 (61_clubs_monthly_court_fee.sql) | NULL 허용·0 이상 정수. 코트비 셀 입력 기본값 + 매트릭스 "월 코트비" 컬럼. 재정 설정에서 입력 |
| `clubs.monthly_dev_fund` | 월 발전기금 기준 금액 (62_clubs_monthly_dev_fund.sql) | 위와 동일 구조. 발전기금 탭 셀 입력 기본값 + "월 발전기금" 컬럼 |

RLS: 5개 테이블 모두 `profiles.role IN ('ADMIN','SUPER_ADMIN')`만 ALL. 앱 레벨(페이지 가드·Server Action·사이드바)은 SUPER_ADMIN만 허용 — 실제 접근은 admin client(Service Role)로 이뤄지므로 앱 가드가 유효 경계.

## 핵심 규칙

1. **잔액은 저장하지 않는다.** `이월잔액 = opening_balance + Σ(월 시작 이전 거래)`, 행 잔액은 시간순 누적 — `computeRunningBalances`
2. **월 경계는 KST.** `getKSTMonthRange(year, month)` → `[start, end)` UTC ISO. 서버 TZ와 무관
3. **금액 = 양의 정수(원), 방향 = 분류 kind.** 입금/출금 두 컬럼 대신 단일 amount
4. **왕복 최소화.** 월별 원장은 계정·분류·거래(월말까지 전체) 3쿼리 병렬 → 메모리에서 이월/당월 분리. 연간 요약도 3쿼리
5. **분류·클럽 FK 강제.** 거래 저장 시 분류가 해당 계정 소속인지 서버에서 확인 (`assertCategoryBelongs`)

## 엑셀 가져오기

- 파서는 순수 함수 → vitest에서 실제 결산서로 검증. **기준은 요약 시트 수식이 아니라 각 월 시트의 마지막 잔액(은행 실잔액)**: 위탁 1~8월, 협회 1~8월 전부 일치
- 요약 시트(`월별수지결산`)는 수식 오류가 있어 참고 리포트만 출력 (협회 8월 수입에 이월잔액 합산, 분류 오타 행 SUMIF 누락 등 6건)
- 날짜: 문자열 `YYYY-MM-DD HH:mm`, Excel 일련번호(46023 = 2026-01-01), `6월27일` 한글 표기(직전 거래 연도 상속) 모두 처리
- `import_key = xlsx:{계정}:{hash(일시|적요|방향|금액)}` → 재가져오기 시 중복 자동 건너뜀
- 분류 매핑: 파서가 오타·약칭 보정(`동회회`→`동호회코트비`, `체육회장배`→`체육회장배대회`) 후 위저드에서 확정. 미매핑 분류가 있으면 가져오기 버튼 비활성
- 클럽 매핑: 클럽명 일치 → `finance_club_aliases` → 수동. 클럽이 아닌 힌트(`2월발전기금` 등)는 "연결 안 함"

## 연회비 (원장 미연동)

- 협회비는 클럽별 **고정 100,000원**(`CLUB_ANNUAL_FEE_AMOUNT`, `src/lib/clubs/fee.ts`)이며 `club_fee_payments`(club_id, year, paid_at)로만 관리한다. 협회통장 원장에는 기록하지 않는다 (2026-09-11 연동 제거, 자동 생성됐던 `source='CLUB_FEE'` 거래 36건 삭제).
- 클럽 납부 현황 협회비 탭: 전체 활성 클럽 × 납부 스위치(`setClubFeePaid`) + 납부일 수정(`setClubFeePaidAt`). 금액 컬럼은 납부 시 고정 금액 표시.
- 코트비·발전기금만 원장 거래(`MonthlyPaymentKind`)로 셀 입력·집계한다. `finance_transactions.source`의 `CLUB_FEE` 값은 CHECK 제약에 남아 있으나 더 이상 생성하지 않는다.

## 검증

- `vitest run src/lib/finance`: 24 tests (KST 경계, 누적 잔액, 소계, 월별 합계, 달성률, 입력 검증, 파서, 실데이터 잔액 대조)
- `tsc --noEmit`, `next build` 통과
