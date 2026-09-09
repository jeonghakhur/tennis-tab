/**
 * 재정 원장 순수 계산 로직 (DB·React 의존 없음 → 단위 테스트 대상)
 * - 잔액은 항상 계산값: 기초잔액 + Σ수입 − Σ지출
 * - 월 경계는 KST 기준
 */
import type { CategoryKind, CategorySubtotal, FinanceTransaction, LedgerRow, MonthlyTotal } from './types'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 (year, month) 의 [시작, 다음달 시작) UTC ISO 경계 */
export function getKSTMonthRange(year: number, month: number): { start: string; end: string } {
  // KST 자정 = UTC 전날 15:00
  const start = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS)
  const end = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** KST 기준 연도 경계 */
export function getKSTYearRange(year: number): { start: string; end: string } {
  return { start: getKSTMonthRange(year, 1).start, end: getKSTMonthRange(year, 12).end }
}

/** ISO 시각 → KST 기준 { year, month(1-12), day } */
export function toKSTParts(iso: string): { year: number; month: number; day: number } {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** 수입이면 +amount, 지출이면 −amount */
export function signedAmount(kind: CategoryKind, amount: number): number {
  return kind === 'INCOME' ? amount : -amount
}

/** 거래 목록(시간순) → 누적 잔액이 붙은 원장 행 */
export function computeRunningBalances(
  openingBalance: number,
  transactions: FinanceTransaction[],
): LedgerRow[] {
  let balance = openingBalance
  return transactions.map((tx) => {
    balance += signedAmount(tx.category.kind, tx.amount)
    return { ...tx, balance }
  })
}

/** 거래 합계: { income, expense } */
export function sumByKind(transactions: Pick<FinanceTransaction, 'amount' | 'category'>[]): {
  income: number
  expense: number
} {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    if (tx.category.kind === 'INCOME') income += tx.amount
    else expense += tx.amount
  }
  return { income, expense }
}

/**
 * 분류별 소계 — 활성 분류는 거래가 없어도 0으로 포함 (엑셀 상단 요약표와 동일하게 전 항목 표시)
 */
export function subtotalByCategory(
  transactions: Pick<FinanceTransaction, 'amount' | 'category_id'>[],
  categories: Array<{ id: string; name: string; kind: CategoryKind; sort_order: number; is_active: boolean }>,
): CategorySubtotal[] {
  const map = new Map<string, CategorySubtotal>()
  for (const c of categories) {
    if (!c.is_active) continue
    map.set(c.id, { category_id: c.id, name: c.name, kind: c.kind, amount: 0, sort_order: c.sort_order })
  }
  for (const tx of transactions) {
    const entry = map.get(tx.category_id)
    if (entry) {
      entry.amount += tx.amount
    } else {
      // 비활성 분류에 남은 거래도 합계에는 포함
      const c = categories.find((x) => x.id === tx.category_id)
      if (c) map.set(c.id, { category_id: c.id, name: c.name, kind: c.kind, amount: tx.amount, sort_order: c.sort_order })
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'INCOME' ? -1 : 1
    return a.sort_order - b.sort_order
  })
}

/**
 * 연간 월별 합계 — 거래를 KST 월로 묶고 잔액을 누적
 * @param openingBalance 해당 연도 1월 1일 기준 이월잔액
 */
export function buildMonthlyTotals(
  openingBalance: number,
  transactions: Pick<FinanceTransaction, 'amount' | 'category' | 'occurred_at'>[],
): MonthlyTotal[] {
  const income = new Array<number>(12).fill(0)
  const expense = new Array<number>(12).fill(0)
  for (const tx of transactions) {
    const { month } = toKSTParts(tx.occurred_at)
    if (tx.category.kind === 'INCOME') income[month - 1] += tx.amount
    else expense[month - 1] += tx.amount
  }
  let balance = openingBalance
  return income.map((inc, i) => {
    const net = inc - expense[i]
    balance += net
    return { month: i + 1, income: inc, expense: expense[i], net, balance }
  })
}

/** 달성률 % (소수 1자리), 계획 0이면 null */
export function achievementRate(planned: number, actual: number): number | null {
  if (planned <= 0) return null
  return Math.round((actual / planned) * 1000) / 10
}

/** 원 단위 표시 */
export function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR')
}
