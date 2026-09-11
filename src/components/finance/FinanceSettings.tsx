'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FinanceAccount, FinanceCategory, BudgetReportRow } from '@/lib/finance/types'
import type { ClubOption } from '@/lib/finance/actions'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { AccountSettings } from './settings/AccountSettings'
import { CategorySettings } from './settings/CategorySettings'
import { AliasSettings } from './settings/AliasSettings'
import { ClubCourtSettings } from './settings/ClubCourtSettings'
import { BudgetSettings } from './settings/BudgetSettings'

interface Props {
  accounts: FinanceAccount[]
  categoriesByAccount: Record<string, FinanceCategory[]>
  aliases: Array<{ alias: string; club_id: string; club_name: string }>
  clubs: ClubOption[]
  budgets: BudgetReportRow[]
  year: number
}

/** 설정 섹션 컨테이너 — 피드백(Toast/Alert)과 refresh를 한 곳에서 처리 */
export function FinanceSettings({ accounts, categoriesByAccount, aliases, clubs, budgets, year }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const feedback = {
    onError: (message: string) => setAlert({ isOpen: true, message }),
    onSuccess: (message: string) => { setToast({ isOpen: true, message }); router.refresh() },
  }

  return (
    <div className="space-y-10">
      <AccountSettings accounts={accounts} {...feedback} />
      <CategorySettings accounts={accounts} categoriesByAccount={categoriesByAccount} {...feedback} />
      <ClubCourtSettings clubs={clubs} {...feedback} />
      <AliasSettings aliases={aliases} clubs={clubs} {...feedback} />
      <BudgetSettings accounts={accounts} categoriesByAccount={categoriesByAccount} budgets={budgets} year={year} {...feedback} />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type="success" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type="error" />
    </div>
  )
}
