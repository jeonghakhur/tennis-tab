/**
 * 재정 관리 도메인 타입
 */
export type AccountType = 'CONSIGNMENT' | 'ASSOCIATION' | 'BOARD'
export type CategoryKind = 'INCOME' | 'EXPENSE'
export type TransactionSource = 'MANUAL' | 'IMPORT' | 'CLUB_FEE' | 'TOSS'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CONSIGNMENT: '위탁통장',
  ASSOCIATION: '협회통장',
  BOARD: '이사회비',
}

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  INCOME: '수입',
  EXPENSE: '지출',
}

export interface FinanceAccount {
  id: string
  name: string
  account_type: AccountType
  opening_balance: number
  opening_date: string // YYYY-MM-DD
  is_active: boolean
  sort_order: number
}

export interface FinanceCategory {
  id: string
  account_id: string
  kind: CategoryKind
  name: string
  sort_order: number
  is_active: boolean
}

/** 거래 (JOIN 포함) */
export interface FinanceTransaction {
  id: string
  account_id: string
  category_id: string
  occurred_at: string
  description: string
  amount: number
  memo: string | null
  club_id: string | null
  tournament_id: string | null
  source: TransactionSource
  import_key: string | null
  created_by: string | null
  category: { name: string; kind: CategoryKind }
  club: { name: string } | null
}

/** 원장 행: 거래 + 누적 잔액 */
export interface LedgerRow extends FinanceTransaction {
  balance: number
}

/** 분류별 소계 */
export interface CategorySubtotal {
  category_id: string
  name: string
  kind: CategoryKind
  amount: number
  sort_order: number
}

/** 월별 원장 응답 */
export interface MonthLedger {
  account: FinanceAccount
  year: number
  month: number
  /** 전월 이월잔액 */
  openingBalance: number
  totalIncome: number
  totalExpense: number
  /** 당월 순이익 */
  net: number
  /** 월말 잔액 */
  closingBalance: number
  subtotals: CategorySubtotal[]
  rows: LedgerRow[]
  categories: FinanceCategory[]
}

/** 연간 요약 — 계정별 월 수입/지출 */
export interface MonthlyTotal {
  month: number
  income: number
  expense: number
  net: number
  balance: number
}

export interface AccountAnnualSummary {
  account: FinanceAccount
  openingBalance: number
  months: MonthlyTotal[]
  totalIncome: number
  totalExpense: number
  subtotals: CategorySubtotal[]
}

/** 거래 입력 */
export interface TransactionInput {
  account_id: string
  category_id: string
  occurred_at: string // ISO
  description: string
  amount: number
  memo?: string | null
  club_id?: string | null
  tournament_id?: string | null
}

export interface FinanceBudget {
  id: string
  year: number
  account_id: string
  label: string
  kind: CategoryKind
  category_ids: string[]
  planned_amount: number
  memo: string | null
  sort_order: number
}

export interface BudgetReportRow extends FinanceBudget {
  actual_amount: number
  /** 달성률 % (계획 0이면 null) */
  achievement: number | null
}

/** 코트 시간대 목록 — 매트릭스 정렬 순서이자 설정 select 옵션 */
export const COURT_SLOTS = ['조기', '주중오전', '주중오후', '주중1회', '주말1회', '주말오전', '주말오후', '주말오전,오후'] as const

/** 클럽 납부 매트릭스 */
export interface ClubPaymentRow {
  club_id: string
  club_name: string
  court_slot: string | null
  /** 월 코트비 기준 금액 (재정 설정에서 입력, NULL = 미설정) */
  monthly_court_fee: number | null
  /** 월 발전기금 기준 금액 (재정 설정에서 입력, NULL = 미설정) */
  monthly_dev_fund: number | null
  /** index 0 = 1월 … 11 = 12월 */
  months: number[]
  total: number
  /** 협회비 탭 전용: club_fee_payments 기준 납부 여부 (다른 탭은 undefined) */
  fee_paid?: boolean
  fee_paid_at?: string | null
}

/** 클럽 납부 셀 상세 — 해당 클럽·항목·기간의 거래 목록 */
export interface ClubPaymentDetail {
  club: { id: string; name: string }
  account_id: string
  category_id: string
  /** 입력 기본값 — 코트비·발전기금은 클럽 월 기준 금액 설정, 없으면 같은 항목 최근 납부 금액 */
  suggestedAmount: number | null
  transactions: Array<{
    id: string
    occurred_at: string
    description: string
    amount: number
    memo: string | null
    source: string
  }>
}
