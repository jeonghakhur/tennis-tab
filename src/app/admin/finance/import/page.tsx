import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireFinanceAdminPage } from '@/lib/finance/pageAuth'
import { getAccounts, getCategories, getClubsForFinance, getClubAliases } from '@/lib/finance/actions'
import { ImportWizard } from '@/components/finance/ImportWizard'

export default async function FinanceImportPage() {
  await requireFinanceAdminPage()
  const accounts = await getAccounts(true)
  const [categoryLists, clubs, aliases] = await Promise.all([
    Promise.all(accounts.map((a) => getCategories(a.id, true))),
    getClubsForFinance(),
    getClubAliases(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="재정 관리로 돌아가기">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">엑셀 가져오기</h1>
          <p className="text-(--text-secondary) mt-1">기존 월별수지결산서(.xlsx)의 위탁통장·협회통장·이사회비 거래를 한 번에 가져옵니다.</p>
        </div>
      </div>
      <ImportWizard accounts={accounts} categories={categoryLists.flat()} clubs={clubs} aliases={aliases} />
    </div>
  )
}
