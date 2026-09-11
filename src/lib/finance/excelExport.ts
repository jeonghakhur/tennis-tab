/**
 * 결산서 엑셀 시트 빌더 (순수 함수 — 브라우저/서버 공용, DB 의존 없음)
 *
 * 연간 내보내기(/api/admin/finance/export)와 월 상세 화면의 "엑셀 내보내기"가 같은 빌더를 쓴다.
 * → 어느 경로로 받아도 해당 월 시트의 구성이 동일하다.
 *
 * 월 시트 구성: [제목] → [분류별 소계 표] → [거래 목록 + 누적 잔액] → [합계]
 */
import type * as XLSXType from 'xlsx'
import type { AccountType, CategorySubtotal, LedgerRow, MonthLedger } from './types'
import { formatKoreanDateTime } from '@/lib/utils/formatDate'

export type Cell = string | number

/** Excel 시트명 최대 길이 */
const SHEET_NAME_MAX = 31
/** 금액 셀 서식 (천 단위 구분) */
const WON_FORMAT = '#,##0'
/** 월 시트 열 너비 */
const MONTH_SHEET_COLS: XLSXType.ColInfo[] = [
  { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
]

export interface MonthSheetInput {
  accountName: string
  month: number
  /** 전월 이월잔액 */
  openingBalance: number
  totalIncome: number
  totalExpense: number
  subtotals: CategorySubtotal[]
  /** 누적 잔액이 붙은 거래 (시간순) */
  rows: LedgerRow[]
}

/** 계정 유형 + 월 → 시트명 (위탁 `N월`, 협회 `협회N월`, 그 외 `{통장명}N월`) */
export function monthSheetName(accountType: AccountType, accountName: string, month: number): string {
  if (accountType === 'CONSIGNMENT') return `${month}월`
  if (accountType === 'ASSOCIATION') return `협회${month}월`
  return `${accountName}${month}월`.slice(0, SHEET_NAME_MAX)
}

/** 월 상세 다운로드 파일명 */
export function monthLedgerFileName(ledger: MonthLedger): string {
  return `${ledger.account.name}_${ledger.year}년_${ledger.month}월_수지결산.xlsx`
}

/** 입금/출금 칸: 해당 방향이 아니면 빈 칸 */
function splitAmount(row: LedgerRow): { income: Cell; expense: Cell } {
  const isIncome = row.category.kind === 'INCOME'
  return { income: isIncome ? row.amount : '', expense: isIncome ? '' : row.amount }
}

/** 월 시트 행 데이터 (AOA) */
export function buildMonthSheetRows(input: MonthSheetInput): Cell[][] {
  const { accountName, month, openingBalance, totalIncome, totalExpense, subtotals, rows } = input
  const closing = openingBalance + totalIncome - totalExpense
  const incomeSubtotals = subtotals.filter((s) => s.kind === 'INCOME')
  const expenseSubtotals = subtotals.filter((s) => s.kind === 'EXPENSE')

  return [
    [`${accountName} ${month}월 수지결산서`],
    [],
    ['구분', '분류', '수입금액', '지출금액', '비고'],
    ['수입', '이월잔액', openingBalance, ''],
    ...incomeSubtotals.map((s): Cell[] => ['수입', s.name, s.amount, '']),
    ...expenseSubtotals.map((s): Cell[] => ['지출', s.name, '', s.amount]),
    ['합계', '', openingBalance + totalIncome, totalExpense, closing],
    [],
    ['일시', '적요', '분류', '클럽', '입금액', '출금액', '비고', '잔액'],
    ...rows.map((r): Cell[] => {
      const { income, expense } = splitAmount(r)
      return [formatKoreanDateTime(r.occurred_at), r.description, r.category.name, r.club?.name ?? '', income, expense, r.memo ?? '', r.balance]
    }),
    ['', '', '', '합계', totalIncome, totalExpense, '', closing],
  ]
}

/** 시트의 모든 숫자 셀에 원 단위 서식 적용 */
function applyWonFormat(ws: XLSXType.WorkSheet, xlsx: typeof XLSXType) {
  if (!ws['!ref']) return
  const range = xlsx.utils.decode_range(ws['!ref'])
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[xlsx.utils.encode_cell({ r, c })] as XLSXType.CellObject | undefined
      if (cell?.t === 'n') cell.z = WON_FORMAT
    }
  }
}

/** 월 시트 워크시트 생성 (열 너비·금액 서식 포함) */
export function buildMonthWorksheet(input: MonthSheetInput, xlsx: typeof XLSXType): XLSXType.WorkSheet {
  const ws = xlsx.utils.aoa_to_sheet(buildMonthSheetRows(input))
  ws['!cols'] = MONTH_SHEET_COLS
  applyWonFormat(ws, xlsx)
  return ws
}

/** 월 원장(화면 데이터) → 시트 1장짜리 워크북 */
export function buildMonthLedgerWorkbook(ledger: MonthLedger, xlsx: typeof XLSXType): XLSXType.WorkBook {
  const ws = buildMonthWorksheet(
    {
      accountName: ledger.account.name,
      month: ledger.month,
      openingBalance: ledger.openingBalance,
      totalIncome: ledger.totalIncome,
      totalExpense: ledger.totalExpense,
      subtotals: ledger.subtotals,
      rows: ledger.rows,
    },
    xlsx,
  )
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, monthSheetName(ledger.account.account_type, ledger.account.name, ledger.month))
  return wb
}
