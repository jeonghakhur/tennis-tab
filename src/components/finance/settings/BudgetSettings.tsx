'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { FinanceAccount, FinanceCategory, BudgetReportRow, CategoryKind } from '@/lib/finance/types'
import { formatWon } from '@/lib/finance/ledger'
import { upsertBudget, deleteBudget } from '@/lib/finance/actions'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { Badge } from '@/components/common/Badge'

interface Props {
  accounts: FinanceAccount[]
  categoriesByAccount: Record<string, FinanceCategory[]>
  budgets: BudgetReportRow[]
  year: number
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

interface BudgetForm {
  id?: string
  account_id: string
  label: string
  kind: CategoryKind
  category_ids: string[]
  planned_amount: string
  memo: string
}

/** 연간 운영계획(예산) — 항목별 계획 금액 + 실적 집계 분류 선택 */
export function BudgetSettings({ accounts, categoriesByAccount, budgets, year, onError, onSuccess }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<BudgetForm | null>(null)
  const [deleting, setDeleting] = useState<BudgetReportRow | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => setForm({ account_id: accounts[0]?.id ?? '', label: '', kind: 'EXPENSE', category_ids: [], planned_amount: '', memo: '' })
  const openEdit = (b: BudgetReportRow) => setForm({ id: b.id, account_id: b.account_id, label: b.label, kind: b.kind, category_ids: b.category_ids, planned_amount: String(b.planned_amount), memo: b.memo ?? '' })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const planned = Number(form.planned_amount.replace(/,/g, ''))
    if (!form.label.trim()) return onError('항목 이름을 입력해주세요.')
    if (!Number.isInteger(planned) || planned < 0) return onError('계획 금액은 0 이상의 정수(원)여야 합니다.')
    setSaving(true)
    const r = await upsertBudget({ id: form.id, year, account_id: form.account_id, label: form.label, kind: form.kind, category_ids: form.category_ids, planned_amount: planned, memo: form.memo })
    setSaving(false)
    if (r.error) return onError(r.error)
    setForm(null)
    onSuccess('운영계획이 저장되었습니다.')
  }

  const remove = async () => {
    if (!deleting) return
    const r = await deleteBudget(deleting.id)
    setDeleting(null)
    if (r.error) return onError(r.error)
    onSuccess('운영계획 항목이 삭제되었습니다.')
  }

  const formCategories = form ? (categoriesByAccount[form.account_id] ?? []).filter((c) => c.kind === form.kind && c.is_active) : []

  return (
    <section id="budgets" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-(--text-primary)">{year}년 운영계획</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="budget-year" className="text-sm text-(--text-muted)">연도</label>
          <input id="budget-year" type="number" value={year} onChange={(e) => router.push(`/admin/finance/settings?year=${e.target.value}#budgets`)} className="input-field text-sm w-24" />
          <button type="button" onClick={openNew} className="btn-secondary btn-sm flex items-center gap-1"><Plus className="w-4 h-4" />항목 추가</button>
        </div>
      </div>
      <p className="text-sm text-(--text-muted)">항목마다 실적으로 집계할 분류를 고르면 대시보드에서 달성률이 계산됩니다. 여러 분류를 묶어 한 항목(예: 시설 및 일반관리비)으로 볼 수 있습니다.</p>
      <div className="glass-card rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-(--text-muted) border-b border-(--border-color)">
              <th className="text-left px-4 py-2.5 font-medium">항목</th>
              <th className="text-left px-4 py-2.5 font-medium">통장</th>
              <th className="text-right px-4 py-2.5 font-medium">계획</th>
              <th className="text-right px-4 py-2.5 font-medium">실적</th>
              <th className="text-right px-4 py-2.5 font-medium">달성률</th>
              <th className="px-4 py-2.5"><span className="sr-only">작업</span></th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="border-b border-(--border-color)/50 text-(--text-primary)">
                <td className="px-4 py-2"><Badge variant={b.kind === 'INCOME' ? 'success' : 'secondary'} className="mr-2">{b.kind === 'INCOME' ? '수입' : '지출'}</Badge>{b.label}</td>
                <td className="px-4 py-2 text-(--text-secondary)">{accounts.find((a) => a.id === b.account_id)?.name ?? '-'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatWon(b.planned_amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatWon(b.actual_amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{b.achievement === null ? '-' : `${b.achievement}%`}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  <button type="button" onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--text-muted)" aria-label={`${b.label} 수정`}><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setDeleting(b)} className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--color-danger)" aria-label={`${b.label} 삭제`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {budgets.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-(--text-muted)">등록된 항목이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={form !== null} onClose={() => setForm(null)} title={form?.id ? '운영계획 수정' : '운영계획 추가'} size="md">
        {form && (
          <form onSubmit={save} noValidate>
            <Modal.Body>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bg-account" className="block text-sm text-(--text-muted) mb-1">통장</label>
                    <select id="bg-account" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value, category_ids: [] })} className="input-field text-sm">
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bg-kind" className="block text-sm text-(--text-muted) mb-1">구분</label>
                    <select id="bg-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CategoryKind, category_ids: [] })} className="input-field text-sm">
                      <option value="INCOME">수입</option><option value="EXPENSE">지출</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="bg-label" className="block text-sm text-(--text-muted) mb-1">항목 이름</label>
                  <input id="bg-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={50} placeholder="예: 시설 및 일반관리비" className="input-field text-sm" />
                </div>
                <div>
                  <label htmlFor="bg-amount" className="block text-sm text-(--text-muted) mb-1">계획 금액(원)</label>
                  <input id="bg-amount" inputMode="numeric" value={form.planned_amount} onChange={(e) => setForm({ ...form, planned_amount: e.target.value.replace(/[^\d,]/g, '') })} className="input-field text-sm text-right" />
                </div>
                <fieldset>
                  <legend className="block text-sm text-(--text-muted) mb-1">실적 집계 분류</legend>
                  <div className="flex flex-wrap gap-2">
                    {formCategories.map((c) => {
                      const on = form.category_ids.includes(c.id)
                      return (
                        <label key={c.id} className={`px-3 py-1.5 rounded-full text-sm cursor-pointer border ${on ? 'bg-(--accent-color) text-(--bg-primary) border-transparent' : 'bg-(--bg-secondary) text-(--text-secondary) border-(--border-color)'}`}>
                          <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setForm({ ...form, category_ids: e.target.checked ? [...form.category_ids, c.id] : form.category_ids.filter((id) => id !== c.id) })} />
                          {c.name}
                        </label>
                      )
                    })}
                    {formCategories.length === 0 && <span className="text-sm text-(--text-muted)">해당 통장·구분의 분류가 없습니다.</span>}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="bg-memo" className="block text-sm text-(--text-muted) mb-1">비고</label>
                  <input id="bg-memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} maxLength={200} className="input-field text-sm" />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button type="button" onClick={() => setForm(null)} className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-sm">취소</button>
              <button type="submit" disabled={saving} className="flex-1 btn-primary"><span className="relative z-10">{saving ? '저장 중...' : '저장'}</span></button>
            </Modal.Footer>
          </form>
        )}
      </Modal>

      <ConfirmDialog isOpen={deleting !== null} onClose={() => setDeleting(null)} onConfirm={remove} title="운영계획 삭제" message={`${deleting?.label} 항목을 삭제하시겠습니까?`} type="error" confirmText="삭제" />
    </section>
  )
}
