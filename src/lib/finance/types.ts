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

/** 클럽 납부 매트릭스 */
export interface ClubPaymentRow {
  club_id: string
  club_name: string
  court_slot: string | null
  /** index 0 = 1월 … 11 = 12월 */
  months: number[]
  total: number
}
