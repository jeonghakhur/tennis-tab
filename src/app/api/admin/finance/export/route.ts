import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient, getVerifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMinimumRole } from '@/lib/auth/roles'
import { getKSTYearRange, sumByKind, subtotalByCategory, buildMonthlyTotals, toKSTParts, computeRunningBalances } from '@/lib/finance/ledger'
import { buildMonthWorksheet, monthSheetName, type Cell } from '@/lib/finance/excelExport'
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '@/lib/finance/types'
const TX_SELECT = '*, category:finance_categories!inner(name, kind), club:clubs(name)'

/** 연간 결산서 엑셀 — 기존 양식(통장별 월 시트 + 월별수지결산)과 같은 구성 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!hasMinimumRole(profile?.role, 'ADMIN')) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const url = new URL(request.url)
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear()
  const { end } = getKSTYearRange(year)
  const admin = createAdminClient()

  const [accountsRes, categoriesRes, txRes] = await Promise.all([
    admin.from('finance_accounts').select('*').eq('is_active', true).order('sort_order'),
    admin.from('finance_categories').select('*').order('kind').order('sort_order'),
    admin.from('finance_transactions').select(TX_SELECT).lt('occurred_at', end).order('occurred_at').order('created_at'),
  ])
  const accounts = (accountsRes.data ?? []) as FinanceAccount[]
  const categories = (categoriesRes.data ?? []) as FinanceCategory[]
  const all = (txRes.data ?? []) as unknown as FinanceTransaction[]
  const { start } = getKSTYearRange(year)

  const wb = XLSX.utils.book_new()
  const summaryBlocks: Cell[][] = []

  for (const account of accounts) {
    const mine = all.filter((t) => t.account_id === account.id)
    const before = mine.filter((t) => t.occurred_at < start)
    const inYear = mine.filter((t) => t.occurred_at >= start)
    const b = sumByKind(before)
    const yearOpening = account.opening_balance + b.income - b.expense
    const accCategories = categories.filter((c) => c.account_id === account.id)

    let running = yearOpening
    for (let m = 1; m <= 12; m++) {
      const inMonth = inYear.filter((t) => toKSTParts(t.occurred_at).month === m)
      const { income, expense } = sumByKind(inMonth)
      const ws = buildMonthWorksheet(
        {
          accountName: account.name,
          month: m,
          openingBalance: running,
          totalIncome: income,
          totalExpense: expense,
          subtotals: subtotalByCategory(inMonth, accCategories),
          rows: computeRunningBalances(running, inMonth),
        },
        XLSX,
      )
      XLSX.utils.book_append_sheet(wb, ws, monthSheetName(account.account_type, account.name, m))
      running += income - expense
    }

    // 요약 블록
    const months = buildMonthlyTotals(yearOpening, inYear)
    const { income, expense } = sumByKind(inYear)
    summaryBlocks.push(
      [`${account.name} 월별 수입 지출`],
      ['월', '수입', '지출', '순이익', '잔액'],
      ...months.map((mt) => [`${String(mt.month).padStart(2, '0')}월`, mt.income, mt.expense, mt.net, mt.balance] as Cell[]),
      ['합계', income, expense, income - expense, months[11]?.balance ?? yearOpening],
      [],
      ['구분', '분류', '수입금액', '지출금액'],
      ...subtotalByCategory(inYear, accCategories).map((s) => [s.kind === 'INCOME' ? '수입' : '지출', s.name, s.kind === 'INCOME' ? s.amount : '', s.kind === 'EXPENSE' ? s.amount : ''] as Cell[]),
      [],
      [],
    )
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryBlocks)
  summaryWs['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, '월별수지결산')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `${year}년월별수지결산서_${today}.xlsx`
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
