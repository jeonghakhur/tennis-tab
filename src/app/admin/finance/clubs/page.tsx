import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireFinanceAdminPage } from '@/lib/finance/pageAuth'
import { getClubPaymentMatrix, type ClubPaymentKind } from '@/lib/finance/actions'
import { getCurrentKSTYear } from '@/lib/utils/formatDate'
import { ClubPaymentMatrix } from '@/components/finance/ClubPaymentMatrix'

interface PageProps {
  searchParams: Promise<{ year?: string; kind?: string }>
}

export default async function FinanceClubsPage({ searchParams }: PageProps) {
  await requireFinanceAdminPage()
  const sp = await searchParams
  const year = Number(sp.year) || getCurrentKSTYear()
  const kind: ClubPaymentKind = sp.kind === 'DEV_FUND' ? 'DEV_FUND' : sp.kind === 'ANNUAL_FEE' ? 'ANNUAL_FEE' : 'COURT_FEE'
  const rows = await getClubPaymentMatrix(year, kind)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/finance" className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="재정 관리로 돌아가기">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">클럽 납부 현황</h1>
          <p className="text-(--text-secondary) mt-1">거래에 클럽을 연결하면 월별 코트비·발전기금·협회비 납부 현황이 자동 집계됩니다.</p>
        </div>
      </div>
      <ClubPaymentMatrix year={year} kind={kind} rows={rows} />
    </div>
  )
}
