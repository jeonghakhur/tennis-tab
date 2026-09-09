'use client'

import { useRef, useState, useCallback } from 'react'
import type { FinanceCategory, TransactionInput } from '@/lib/finance/types'
import { validateTransactionInput, hasValidationErrors, type TransactionValidationErrors } from '@/lib/utils/validation'
import { generateTransactionDummy, generateTransactionInvalidDummy } from '@/lib/utils/devDummy'
import { ClubCombobox } from './ClubCombobox'
import type { ClubOption } from '@/lib/finance/actions'

const isDev = process.env.NODE_ENV === 'development'

export interface TransactionFormValues {
  occurred_at: string // datetime-local 형식 (브라우저 로컬 = KST)
  category_id: string
  description: string
  amount: string
  club_id: string | null
  memo: string
}

interface Props {
  accountId: string
  categories: FinanceCategory[]
  clubs: ClubOption[]
  initial: TransactionFormValues
  submitLabel: string
  onSubmit: (input: TransactionInput) => Promise<{ error?: string }>
  onError: (message: string) => void
  onSuccess: () => void
  /** 인라인 모드: 저장 후 폼 초기화 + 적요 포커스 (연속 입력) */
  inline?: boolean
  onCancel?: () => void
}

const FIELD_ORDER: (keyof TransactionValidationErrors)[] = ['occurred_at', 'category_id', 'description', 'amount', 'memo']

/** ISO → datetime-local 값 (브라우저 로컬 기준) */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TransactionForm({ accountId, categories, clubs, initial, submitLabel, onSubmit, onError, onSuccess, inline = false, onCancel }: Props) {
  const [form, setForm] = useState<TransactionFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<TransactionValidationErrors>({})
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({})

  const income = categories.filter((c) => c.kind === 'INCOME')
  const expense = categories.filter((c) => c.kind === 'EXPENSE')

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const buildInput = useCallback((): TransactionInput => ({
    account_id: accountId,
    category_id: form.category_id,
    occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : '',
    description: form.description,
    amount: Number(form.amount.replace(/,/g, '')),
    club_id: form.club_id,
    memo: form.memo,
  }), [accountId, form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = buildInput()
    const errors = validateTransactionInput({ ...input, amount: form.amount })
    if (hasValidationErrors(errors)) {
      for (const field of FIELD_ORDER) {
        if (errors[field]) {
          setFieldErrors({ [field]: errors[field] })
          onError(errors[field]!)
          fieldRefs.current[field]?.focus()
          return
        }
      }
    }
    setFieldErrors({})
    setSaving(true)
    const result = await onSubmit(input)
    setSaving(false)
    if (result.error) {
      onError(result.error)
      return
    }
    onSuccess()
    if (inline) {
      // 연속 입력: 일시·분류·클럽은 유지, 적요·금액·비고만 비움
      setForm((prev) => ({ ...prev, description: '', amount: '', memo: '' }))
      fieldRefs.current.description?.focus()
    }
  }

  const applyDummy = (invalid: boolean) => {
    const d = invalid ? generateTransactionInvalidDummy() : generateTransactionDummy()
    const cat = categories[Math.floor(Math.random() * categories.length)]
    setForm({
      occurred_at: toDatetimeLocal(d.occurred_at),
      category_id: cat?.id ?? '',
      description: d.description,
      amount: String(d.amount),
      club_id: null,
      memo: d.memo,
    })
    setFieldErrors({})
  }

  const inputClass = (field: keyof TransactionValidationErrors) =>
    `input-field text-sm ${fieldErrors[field] ? 'border-(--color-danger)' : ''}`

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {isDev && (
        <div className="flex gap-2 pb-2 border-b border-dashed border-amber-500/30">
          <button type="button" onClick={() => applyDummy(false)} className="btn-outline-purple btn-dashed btn-sm">DEV: 정상 더미 데이터</button>
          <button type="button" onClick={() => applyDummy(true)} className="btn-outline-purple btn-dashed btn-sm">DEV: 잘못된 데이터</button>
        </div>
      )}
      <div className={`grid gap-3 ${inline ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label htmlFor="tx-occurred" className="block text-sm text-(--text-muted) mb-1">일시</label>
          <input id="tx-occurred" ref={(el) => { fieldRefs.current.occurred_at = el }} type="datetime-local" value={form.occurred_at} onChange={(e) => set('occurred_at', e.target.value)} className={inputClass('occurred_at')} />
        </div>
        <div>
          <label htmlFor="tx-category" className="block text-sm text-(--text-muted) mb-1">분류</label>
          <select id="tx-category" ref={(el) => { fieldRefs.current.category_id = el }} value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputClass('category_id')}>
            <option value="">선택</option>
            <optgroup label="수입">{income.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            <optgroup label="지출">{expense.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
        </div>
        <div className={inline ? 'col-span-2 lg:col-span-1' : ''}>
          <label htmlFor="tx-description" className="block text-sm text-(--text-muted) mb-1">적요</label>
          <input id="tx-description" ref={(el) => { fieldRefs.current.description = el }} type="text" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="입금자명 / 내용" maxLength={100} className={inputClass('description')} />
        </div>
        <div>
          <label htmlFor="tx-amount" className="block text-sm text-(--text-muted) mb-1">금액(원)</label>
          <input id="tx-amount" ref={(el) => { fieldRefs.current.amount = el }} type="text" inputMode="numeric" value={form.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d,]/g, ''))} placeholder="350000" className={`${inputClass('amount')} text-right`} />
        </div>
        <div>
          <span className="block text-sm text-(--text-muted) mb-1">클럽</span>
          <ClubCombobox clubs={clubs} value={form.club_id} onChange={(id) => set('club_id', id)} aria-label="거래 클럽" />
        </div>
        <div>
          <label htmlFor="tx-memo" className="block text-sm text-(--text-muted) mb-1">비고</label>
          <input id="tx-memo" ref={(el) => { fieldRefs.current.memo = el }} type="text" value={form.memo} onChange={(e) => set('memo', e.target.value)} maxLength={200} className={inputClass('memo')} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary btn-sm">취소</button>}
        <button type="submit" disabled={saving} className="btn-primary btn-sm">
          <span className="relative z-10">{saving ? '저장 중...' : submitLabel}</span>
        </button>
      </div>
    </form>
  )
}
