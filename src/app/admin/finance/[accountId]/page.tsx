import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireFinanceAdminPage } from '@/lib/finance/pageAuth'
import { getMonthLedger, getClubsForFinance, getAccounts } from '@/lib/finance/actions'
import { getCurrentKSTYear } from '@/lib/utils/formatDate'
import { toKSTParts } from '@/lib/finance/ledger'
import { LedgerManager } from '@/components/finance/LedgerManager'

interface PageProps {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function LedgerPage({ params, searchParams }: PageProps) {
  await requireFinanceAdminPage()
  const { accountId } = await params
  const sp = await searchParams

  const now = toKSTParts(new Date().toISOString())
  const year = Number(sp.year) || getCurrentKSTYear()
  const monthRaw = Number(sp.month)
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : year === now.year ? now.month : 12

  const [ledgerRes, clubs, accounts] = await Promise.all([
    getMonthLedger(accountId, year, month),
    getClubsForFinance(),
    getAccounts(),
  ])
  if (ledgerRes.error || !ledgerRes.data) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/finance?year=${year}`} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="재정 관리로 돌아가기">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">{ledgerRes.data.account.name} 수지결산</h1>
          <p className="text-(--text-secondary) mt-1">거래를 입력하면 이월잔액·소계·월말 잔액이 자동 계산됩니다.</p>
        </div>
      </div>

      <LedgerManager ledger={ledgerRes.data} clubs={clubs} accounts={accounts} />
    </div>
  )
}
