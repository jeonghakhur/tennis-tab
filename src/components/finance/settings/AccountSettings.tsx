'use client'

import { useState } from 'react'
import type { FinanceAccount } from '@/lib/finance/types'
import { ACCOUNT_TYPE_LABELS } from '@/lib/finance/types'
import { updateAccount } from '@/lib/finance/actions'
import { Switch } from '@/components/common/Switch'

interface Props {
  accounts: FinanceAccount[]
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

/** 통장별 이름·기초잔액·기초일·활성 여부 */
export function AccountSettings({ accounts, onError, onSuccess }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-(--text-primary)">통장</h2>
      <p className="text-sm text-(--text-muted)">기초잔액은 기초일 시점의 잔액입니다. 모든 잔액은 기초잔액에서 거래를 누적해 계산됩니다.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((a) => <AccountCard key={a.id} account={a} onError={onError} onSuccess={onSuccess} />)}
      </div>
    </section>
  )
}

function AccountCard({ account, onError, onSuccess }: { account: FinanceAccount; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [name, setName] = useState(account.name)
  const [balance, setBalance] = useState(String(account.opening_balance))
  const [date, setDate] = useState(account.opening_date)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const opening = Number(balance.replace(/,/g, ''))
    if (!Number.isInteger(opening)) return onError('기초잔액은 정수(원)로 입력해주세요.')
    setSaving(true)
    const r = await updateAccount(account.id, { name, opening_balance: opening, opening_date: date })
    setSaving(false)
    if (r.error) return onError(r.error)
    onSuccess(`${name} 정보가 저장되었습니다.`)
  }

  const toggleActive = async (checked: boolean) => {
    const r = await updateAccount(account.id, { is_active: checked })
    if (r.error) return onError(r.error)
    onSuccess(checked ? `${account.name}을(를) 활성화했습니다.` : `${account.name}을(를) 비활성화했습니다.`)
  }

  const nameId = `acc-name-${account.id}`
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-(--text-muted)">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
        <div className="flex items-center gap-2">
          <span id={`acc-active-${account.id}`} className="text-sm text-(--text-muted)">활성</span>
          <Switch checked={account.is_active} onChange={toggleActive} aria-labelledby={`acc-active-${account.id}`} />
        </div>
      </div>
      <div>
        <label htmlFor={nameId} className="block text-sm text-(--text-muted) mb-1">이름</label>
        <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="input-field text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${nameId}-bal`} className="block text-sm text-(--text-muted) mb-1">기초잔액(원)</label>
          <input id={`${nameId}-bal`} inputMode="numeric" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d,-]/g, ''))} className="input-field text-sm text-right" />
        </div>
        <div>
          <label htmlFor={`${nameId}-date`} className="block text-sm text-(--text-muted) mb-1">기초일</label>
          <input id={`${nameId}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field text-sm" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="btn-primary btn-sm"><span className="relative z-10">{saving ? '저장 중' : '저장'}</span></button>
      </div>
    </div>
  )
}
