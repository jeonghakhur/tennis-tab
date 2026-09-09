import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireFinanceAdminPage } from '@/lib/finance/pageAuth'
import { getAccounts, getCategories, getClubAliases, getClubsForFinance, getBudgetReport } from '@/lib/finance/actions'
import { getCurrentKSTYear } from '@/lib/utils/formatDate'
import { FinanceSettings } from '@/components/finance/FinanceSettings'

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function FinanceSettingsPage({ searchParams }: PageProps) {
  await requireFinanceAdminPage()
  const sp = await searchParams
  const year = Number(sp.year) || getCurrentKSTYear()

  const accounts = await getAccounts(true)
  const [categoriesByAccount, aliases, clubs, budgets] = await Promise.all([
    Promise.all(accounts.map((a) => getCategories(a.id, true))),
    getClubAliases(),
    getClubsForFinance(),
    getBudgetReport(year),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="재정 관리로 돌아가기">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">재정 설정</h1>
          <p className="text-(--text-secondary) mt-1">통장·분류·클럽 별칭·연간 운영계획을 관리합니다.</p>
        </div>
      </div>
      <FinanceSettings
        accounts={accounts}
        categoriesByAccount={Object.fromEntries(accounts.map((a, i) => [a.id, categoriesByAccount[i]]))}
        aliases={aliases}
        clubs={clubs}
        budgets={budgets}
        year={year}
      />
    </div>
  )
}
