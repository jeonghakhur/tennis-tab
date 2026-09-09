import Link from 'next/link'
import { Settings, Upload, Building2, Download } from 'lucide-react'
import { requireFinanceAdminPage } from '@/lib/finance/pageAuth'
import { getAnnualSummary, getBudgetReport } from '@/lib/finance/actions'
import { getCurrentKSTYear } from '@/lib/utils/formatDate'
import { FinanceOverview } from '@/components/finance/FinanceOverview'

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function FinancePage({ searchParams }: PageProps) {
  await requireFinanceAdminPage()
  const params = await searchParams
  const currentYear = getCurrentKSTYear()
  const year = Number(params.year) || currentYear

  const [summaries, budgets] = await Promise.all([getAnnualSummary(year), getBudgetReport(year)])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">재정 관리</h1>
          <p className="text-(--text-secondary) mt-1">통장별 월별 수지결산과 운영계획 대비 실적을 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/clubs" className="btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap">
            <Building2 className="w-4 h-4" />
            클럽 납부 현황
          </Link>
          <a href={`/api/admin/finance/export?year=${year}`} className="btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap">
            <Download className="w-4 h-4" />
            엑셀 내보내기
          </a>
          <Link href="/admin/finance/import" className="btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap">
            <Upload className="w-4 h-4" />
            엑셀 가져오기
          </Link>
          <Link href="/admin/finance/settings" className="btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap">
            <Settings className="w-4 h-4" />
            설정
          </Link>
        </div>
      </div>

      <FinanceOverview year={year} currentYear={currentYear} summaries={summaries} budgets={budgets} />
    </div>
  )
}
