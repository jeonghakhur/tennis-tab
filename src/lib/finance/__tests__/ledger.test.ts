import { describe, it, expect } from 'vitest'
import {
  getKSTMonthRange,
  toKSTParts,
  computeRunningBalances,
  sumByKind,
  subtotalByCategory,
  buildMonthlyTotals,
  achievementRate,
} from '../ledger'
import type { FinanceTransaction } from '../types'

const tx = (over: Partial<FinanceTransaction> & { amount: number; kind: 'INCOME' | 'EXPENSE'; at?: string }): FinanceTransaction => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  account_id: 'acc',
  category_id: over.category_id ?? (over.kind === 'INCOME' ? 'cat-in' : 'cat-out'),
  occurred_at: over.at ?? '2026-01-15T03:00:00.000Z',
  description: 'x',
  amount: over.amount,
  memo: null,
  club_id: null,
  tournament_id: null,
  source: 'MANUAL',
  import_key: null,
  created_by: null,
  category: { name: over.kind === 'INCOME' ? '수입' : '지출', kind: over.kind },
  club: null,
})

describe('getKSTMonthRange', () => {
  it('1월 경계는 KST 자정 = 전년 12/31 15:00 UTC', () => {
    const { start, end } = getKSTMonthRange(2026, 1)
    expect(start).toBe('2025-12-31T15:00:00.000Z')
    expect(end).toBe('2026-01-31T15:00:00.000Z')
  })
  it('12월 end는 다음 해 1월 시작', () => {
    expect(getKSTMonthRange(2026, 12).end).toBe('2026-12-31T15:00:00.000Z')
  })
})

describe('toKSTParts', () => {
  it('UTC 15:00 이후는 KST 다음 날', () => {
    expect(toKSTParts('2026-01-31T15:30:00.000Z')).toEqual({ year: 2026, month: 2, day: 1 })
    expect(toKSTParts('2026-01-31T14:59:00.000Z')).toEqual({ year: 2026, month: 1, day: 31 })
  })
})

describe('computeRunningBalances', () => {
  it('기초잔액에서 수입 +, 지출 − 누적 (엑셀 1월 첫 3건)', () => {
    const rows = computeRunningBalances(7091243, [
      tx({ amount: 150000, kind: 'INCOME' }),
      tx({ amount: 150000, kind: 'INCOME' }),
      tx({ amount: 154000, kind: 'EXPENSE' }),
    ])
    expect(rows.map((r) => r.balance)).toEqual([7241243, 7391243, 7237243])
  })
  it('거래 없으면 빈 배열', () => {
    expect(computeRunningBalances(100, [])).toEqual([])
  })
})

describe('sumByKind / subtotalByCategory', () => {
  const cats = [
    { id: 'cat-in', name: '동호회코트비', kind: 'INCOME' as const, sort_order: 1, is_active: true },
    { id: 'cat-in2', name: '개인 코트비', kind: 'INCOME' as const, sort_order: 2, is_active: true },
    { id: 'cat-out', name: '인건비', kind: 'EXPENSE' as const, sort_order: 1, is_active: true },
    { id: 'cat-old', name: '폐지분류', kind: 'EXPENSE' as const, sort_order: 9, is_active: false },
  ]
  const list = [
    tx({ amount: 100, kind: 'INCOME' }),
    tx({ amount: 50, kind: 'INCOME' }),
    tx({ amount: 30, kind: 'EXPENSE' }),
  ]
  it('수입/지출 합계', () => {
    expect(sumByKind(list)).toEqual({ income: 150, expense: 30 })
  })
  it('활성 분류는 0이어도 포함, 수입 먼저 정렬', () => {
    const sub = subtotalByCategory(list, cats)
    expect(sub.map((s) => [s.name, s.amount])).toEqual([
      ['동호회코트비', 150],
      ['개인 코트비', 0],
      ['인건비', 30],
    ])
  })
  it('비활성 분류에 거래가 있으면 포함', () => {
    const sub = subtotalByCategory([tx({ amount: 5, kind: 'EXPENSE', category_id: 'cat-old' })], cats)
    expect(sub.find((s) => s.name === '폐지분류')?.amount).toBe(5)
  })
})

describe('buildMonthlyTotals', () => {
  it('KST 월로 묶고 잔액 누적', () => {
    const months = buildMonthlyTotals(1000, [
      tx({ amount: 500, kind: 'INCOME', at: '2026-01-10T00:00:00.000Z' }),
      tx({ amount: 200, kind: 'EXPENSE', at: '2026-01-31T15:00:00.000Z' }), // KST 2/1
      tx({ amount: 100, kind: 'INCOME', at: '2026-03-05T00:00:00.000Z' }),
    ])
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: 1, income: 500, expense: 0, net: 500, balance: 1500 })
    expect(months[1]).toEqual({ month: 2, income: 0, expense: 200, net: -200, balance: 1300 })
    expect(months[2].balance).toBe(1400)
    expect(months[11].balance).toBe(1400)
  })
})

describe('achievementRate', () => {
  it('소수 1자리 반올림, 계획 0이면 null', () => {
    expect(achievementRate(57700800, 43440160)).toBe(75.3)
    expect(achievementRate(0, 10)).toBeNull()
  })
})
