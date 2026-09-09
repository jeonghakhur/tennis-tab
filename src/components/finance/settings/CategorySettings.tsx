'use client'

import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import type { FinanceAccount, FinanceCategory, CategoryKind } from '@/lib/finance/types'
import { createCategory, updateCategory } from '@/lib/finance/actions'
import { Switch } from '@/components/common/Switch'

interface Props {
  accounts: FinanceAccount[]
  categoriesByAccount: Record<string, FinanceCategory[]>
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

/** 통장별 수입/지출 분류 — 추가·이름 변경·비활성화 (삭제 대신 비활성화로 과거 거래 보존) */
export function CategorySettings({ accounts, categoriesByAccount, onError, onSuccess }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const categories = categoriesByAccount[accountId] ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-(--text-primary)">분류</h2>
      <div className="flex gap-1 border-b border-(--border-color)">
        {accounts.map((a) => (
          <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${a.id === accountId ? 'border-(--accent-color) text-(--accent-color)' : 'border-transparent text-(--text-muted) hover:text-(--text-primary)'}`}>
            {a.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['INCOME', 'EXPENSE'] as const).map((kind) => (
          <KindList key={`${accountId}-${kind}`} accountId={accountId} kind={kind} categories={categories.filter((c) => c.kind === kind)} onError={onError} onSuccess={onSuccess} />
        ))}
      </div>
    </section>
  )
}

function KindList({ accountId, kind, categories, onError, onSuccess }: { accountId: string; kind: CategoryKind; categories: FinanceCategory[]; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const r = await createCategory(accountId, kind, newName)
    setAdding(false)
    if (r.error) return onError(r.error)
    setNewName('')
    onSuccess('분류가 추가되었습니다.')
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-(--text-primary)">{kind === 'INCOME' ? '수입 분류' : '지출 분류'}</p>
      <ul className="space-y-1.5">
        {categories.map((c) => <CategoryRow key={c.id} category={c} onError={onError} onSuccess={onSuccess} />)}
        {categories.length === 0 && <li className="text-sm text-(--text-muted)">분류가 없습니다.</li>}
      </ul>
      <form onSubmit={add} noValidate className="flex gap-2 pt-2 border-t border-(--border-color)">
        <label htmlFor={`new-cat-${accountId}-${kind}`} className="sr-only">새 분류 이름</label>
        <input id={`new-cat-${accountId}-${kind}`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 분류 이름" maxLength={30} className="input-field text-sm flex-1" />
        <button type="submit" disabled={adding || !newName.trim()} className="btn-secondary btn-sm flex items-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" />추가</button>
      </form>
    </div>
  )
}

function CategoryRow({ category, onError, onSuccess }: { category: FinanceCategory; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  const rename = async () => {
    if (name.trim() === category.name) return setEditing(false)
    const r = await updateCategory(category.id, { name })
    if (r.error) return onError(r.error)
    setEditing(false)
    onSuccess('분류 이름이 변경되었습니다.')
  }
  const toggle = async (checked: boolean) => {
    const r = await updateCategory(category.id, { is_active: checked })
    if (r.error) return onError(r.error)
    onSuccess(checked ? `${category.name} 분류를 활성화했습니다.` : `${category.name} 분류를 비활성화했습니다.`)
  }

  return (
    <li className={`flex items-center gap-2 text-sm ${category.is_active ? 'text-(--text-primary)' : 'text-(--text-muted) line-through'}`}>
      {editing ? (
        <>
          <label htmlFor={`cat-${category.id}`} className="sr-only">분류 이름</label>
          <input id={`cat-${category.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="input-field text-sm flex-1 py-1" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename() } if (e.key === 'Escape') setEditing(false) }} />
          <button type="button" onClick={rename} className="p-1 rounded hover:bg-(--bg-secondary) text-(--color-success)" aria-label="이름 저장"><Check className="w-4 h-4" /></button>
          <button type="button" onClick={() => { setName(category.name); setEditing(false) }} className="p-1 rounded hover:bg-(--bg-secondary) text-(--text-muted)" aria-label="취소"><X className="w-4 h-4" /></button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} className="flex-1 text-left hover:underline" title="클릭하여 이름 변경">{category.name}</button>
          <Switch checked={category.is_active} onChange={toggle} aria-label={`${category.name} 활성`} />
        </>
      )}
    </li>
  )
}
