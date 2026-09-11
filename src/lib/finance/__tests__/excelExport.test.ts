import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildMonthLedgerWorkbook, buildMonthSheetRows, monthLedgerFileName, monthSheetName } from '../excelExport'
import { computeRunningBalances } from '../ledger'
import type { FinanceTransaction, MonthLedger } from '../types'

const tx = (over: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'occurred_at' | 'description' | 'amount' | 'category'>): FinanceTransaction => ({
  id: crypto.randomUUID(),
  account_id: 'acc',
  category_id: 'cat',
  memo: null,
  club_id: null,
  tournament_id: null,
  source: 'MANUAL',
  import_key: null,
  created_by: null,
  club: null,
  ...over,
})

function makeLedger(accountType: MonthLedger['account']['account_type'] = 'CONSIGNMENT'): MonthLedger {
  const rows = computeRunningBalances(1_000_000, [
    tx({ occurred_at: '2026-08-03T05:20:00.000Z', description: '난테모 8월 코트비', amount: 300_000, category: { name: '동호회코트비', kind: 'INCOME' }, club: { name: '난테모' }, memo: '비고' }),
    tx({ occurred_at: '2026-08-10T01:00:00.000Z', description: '전기요금', amount: 120_000, category: { name: '수도광열비', kind: 'EXPENSE' } }),
    tx({ occurred_at: '2026-08-20T09:30:00.000Z', description: '이자', amount: 1_500, category: { name: '이자', kind: 'INCOME' } }),
  ])
  return {
    account: { id: 'acc', name: '테스트통장', account_type: accountType, opening_balance: 0, opening_date: '2026-01-01', is_active: true, sort_order: 0 },
    year: 2026,
    month: 8,
    openingBalance: 1_000_000,
    totalIncome: 301_500,
    totalExpense: 120_000,
    net: 181_500,
    closingBalance: 1_181_500,
    subtotals: [
      { category_id: 'c1', name: '동호회코트비', kind: 'INCOME', amount: 300_000, sort_order: 0 },
      { category_id: 'c2', name: '이자', kind: 'INCOME', amount: 1_500, sort_order: 1 },
      { category_id: 'c3', name: '수도광열비', kind: 'EXPENSE', amount: 120_000, sort_order: 0 },
    ],
    rows,
    categories: [],
  }
}

describe('monthSheetName / monthLedgerFileName', () => {
  it('계정 유형별 시트명 (연간 내보내기와 동일 규칙)', () => {
    expect(monthSheetName('CONSIGNMENT', '위탁통장', 8)).toBe('8월')
    expect(monthSheetName('ASSOCIATION', '협회통장', 12)).toBe('협회12월')
    expect(monthSheetName('BOARD', '이사회비', 3)).toBe('이사회비3월')
  })
  it('시트명은 31자 제한', () => {
    expect(monthSheetName('BOARD', '가'.repeat(40), 1).length).toBeLessThanOrEqual(31)
  })
  it('파일명에 통장·연월 포함', () => {
    expect(monthLedgerFileName(makeLedger())).toBe('테스트통장_2026년_8월_수지결산.xlsx')
  })
})

describe('buildMonthSheetRows', () => {
  it('제목 → 소계 표 → 거래 목록(누적 잔액) → 합계 순서', () => {
    const l = makeLedger()
    const rows = buildMonthSheetRows({
      accountName: l.account.name, month: l.month, openingBalance: l.openingBalance,
      totalIncome: l.totalIncome, totalExpense: l.totalExpense, subtotals: l.subtotals, rows: l.rows,
    })
    expect(rows[0]).toEqual(['테스트통장 8월 수지결산서'])
    expect(rows[3]).toEqual(['수입', '이월잔액', 1_000_000, ''])
    expect(rows).toContainEqual(['지출', '수도광열비', '', 120_000])
    expect(rows).toContainEqual(['합계', '', 1_301_500, 120_000, 1_181_500])
    const headerIdx = rows.findIndex((r) => r[0] === '일시')
    expect(rows[headerIdx]).toEqual(['일시', '적요', '분류', '클럽', '입금액', '출금액', '비고', '잔액'])
    expect(rows[headerIdx + 1]).toEqual(['2026. 8. 3. 14:20', '난테모 8월 코트비', '동호회코트비', '난테모', 300_000, '', '비고', 1_300_000])
    expect(rows[headerIdx + 2]).toEqual(['2026. 8. 10. 10:00', '전기요금', '수도광열비', '', '', 120_000, '', 1_180_000])
    expect(rows[rows.length - 1]).toEqual(['', '', '', '합계', 301_500, 120_000, '', 1_181_500])
  })

  it('거래가 없어도 소계·합계 행은 생성', () => {
    const rows = buildMonthSheetRows({ accountName: 'A', month: 2, openingBalance: 500, totalIncome: 0, totalExpense: 0, subtotals: [], rows: [] })
    expect(rows[rows.length - 1]).toEqual(['', '', '', '합계', 0, 0, '', 500])
  })
})

describe('buildMonthLedgerWorkbook', () => {
  it('시트 1장, 시트명은 계정 유형 규칙, 숫자 셀에 천 단위 서식', () => {
    const wb = buildMonthLedgerWorkbook(makeLedger('ASSOCIATION'), XLSX)
    expect(wb.SheetNames).toEqual(['협회8월'])
    const ws = wb.Sheets['협회8월']
    expect(ws['!cols']?.length).toBe(8)
    const opening = ws[XLSX.utils.encode_cell({ r: 3, c: 2 })] as XLSX.CellObject
    expect(opening.v).toBe(1_000_000)
    expect(opening.z).toBe('#,##0')
  })

  it('xlsx 버퍼로 저장·재로드 가능', () => {
    const wb = buildMonthLedgerWorkbook(makeLedger(), XLSX)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const reloaded = XLSX.read(buf, { type: 'buffer' })
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(reloaded.Sheets['8월'], { header: 1, defval: '' })
    expect(aoa[0][0]).toBe('테스트통장 8월 수지결산서')
    expect(aoa[aoa.length - 1].slice(3, 8)).toEqual(['합계', 301_500, 120_000, '', 1_181_500])
  })
})
