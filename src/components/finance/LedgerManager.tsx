'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import type { FinanceAccount, LedgerRow, MonthLedger, TransactionInput } from '@/lib/finance/types'
import { formatWon } from '@/lib/finance/ledger'
import { createTransaction, updateTransaction, deleteTransaction, type ClubOption } from '@/lib/finance/actions'
import { formatKoreanDateTime } from '@/lib/utils/formatDate'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { Badge } from '@/components/common/Badge'
import { TransactionForm, toDatetimeLocal, type TransactionFormValues } from './TransactionForm'

interface Props {
  ledger: MonthLedger
  clubs: ClubOption[]
  accounts: FinanceAccount[]
}

const SOURCE_LABEL: Record<string, string> = { IMPORT: '가져옴', CLUB_FEE: '연회비', TOSS: '토스' }

export function LedgerManager({ ledger, clubs, accounts }: Props) {
  const router = useRouter()
  const { account, year, month } = ledger
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | null>(null)
  const [deleting, setDeleting] = useState<LedgerRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const showError = (message: string) => setAlert({ isOpen: true, message })
  const showSuccess = (message: string) => { setToast({ isOpen: true, message }); router.refresh() }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const href = (y: number, m: number, acc = account.id) => `/admin/finance/${acc}?year=${y}&month=${m}`

  // 인라인 추가 폼 기본값: 해당 월의 오늘(또는 1일) 정오
  const defaultDate = (() => {
    const now = new Date()
    const sameMonth = now.getFullYear() === year && now.getMonth() + 1 === month
    const d = sameMonth ? now : new Date(year, month - 1, 1, 12, 0)
    return toDatetimeLocal(d.toISOString())
  })()
  const emptyForm: TransactionFormValues = { occurred_at: defaultDate, category_id: '', description: '', amount: '', club_id: null, memo: '' }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const result = await deleteTransaction(deleting.id)
    setDeleteBusy(false)
    setDeleting(null)
    if (result.error) return showError(result.error)
    showSuccess('거래가 삭제되었습니다.')
  }

  const incomeSubtotals = ledger.subtotals.filter((s) => s.kind === 'INCOME')
  const expenseSubtotals = ledger.subtotals.filter((s) => s.kind === 'EXPENSE')

  return (
    <div className="space-y-6">
      {/* 통장 탭 + 월 이동 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-(--border-color)">
          {accounts.map((a) => (
            <Link key={a.id} href={href(year, month, a.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${a.id === account.id ? 'border-(--accent-color) text-(--accent-color)' : 'border-transparent text-(--text-muted) hover:text-(--text-primary)'}`}>
              {a.name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={href(prev.year, prev.month)} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="이전 달"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="text-lg font-bold text-(--text-primary) min-w-[7rem] text-center">{year}년 {month}월</span>
          <Link href={href(next.year, next.month)} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="다음 달"><ChevronRight className="w-5 h-5" /></Link>
        </div>
      </div>

      {/* 요약 (엑셀 상단 표 구성) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-semibold text-(--text-primary) mb-2">수입</p>
          <Row label="이월잔액" value={ledger.openingBalance} muted />
          {incomeSubtotals.map((s) => <Row key={s.category_id} label={s.name} value={s.amount} />)}
          <Row label="수입 합계" value={ledger.totalIncome} bold />
        </div>
        <div className="glass-card rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-semibold text-(--text-primary) mb-2">지출</p>
          {expenseSubtotals.map((s) => <Row key={s.category_id} label={s.name} value={s.amount} />)}
          <Row label="지출 합계" value={ledger.totalExpense} bold />
        </div>
        <div className="glass-card rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-semibold text-(--text-primary) mb-2">결산</p>
          <Row label="당월 순이익" value={ledger.net} bold danger={ledger.net < 0} />
          <Row label="월말 잔액" value={ledger.closingBalance} bold />
          <p className="text-sm text-(--text-muted) pt-2">거래 {ledger.rows.length}건</p>
        </div>
      </div>

      {/* 거래 추가 */}
      <div className="glass-card rounded-xl p-4">
        {showAdd ? (
          <TransactionForm
            accountId={account.id}
            categories={ledger.categories}
            clubs={clubs}
            initial={emptyForm}
            submitLabel="추가"
            inline
            onSubmit={createTransaction}
            onError={showError}
            onSuccess={() => showSuccess('거래가 추가되었습니다.')}
            onCancel={() => setShowAdd(false)}
          />
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary btn-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /><span className="relative z-10">거래 추가</span>
          </button>
        )}
      </div>

      {/* 거래 목록 */}
      <div className="glass-card rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-(--text-muted) border-b border-(--border-color)">
              <th className="text-left px-3 py-2.5 font-medium">일시</th>
              <th className="text-left px-3 py-2.5 font-medium">적요</th>
              <th className="text-left px-3 py-2.5 font-medium">분류</th>
              <th className="text-left px-3 py-2.5 font-medium">클럽</th>
              <th className="text-right px-3 py-2.5 font-medium">입금</th>
              <th className="text-right px-3 py-2.5 font-medium">출금</th>
              <th className="text-right px-3 py-2.5 font-medium">잔액</th>
              <th className="text-left px-3 py-2.5 font-medium">비고</th>
              <th className="px-3 py-2.5"><span className="sr-only">작업</span></th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-(--text-muted) border-b border-(--border-color)/50">
              <td className="px-3 py-2" colSpan={6}>이월잔액</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatWon(ledger.openingBalance)}</td>
              <td colSpan={2} />
            </tr>
            {ledger.rows.map((row) => {
              const isIncome = row.category.kind === 'INCOME'
              return (
                <tr key={row.id} className="border-b border-(--border-color)/50 text-(--text-primary) hover:bg-(--bg-card-hover)">
                  <td className="px-3 py-2 whitespace-nowrap text-(--text-secondary)">{formatKoreanDateTime(row.occurred_at)}</td>
                  <td className="px-3 py-2">
                    {row.description}
                    {row.source !== 'MANUAL' && <Badge variant="secondary" className="ml-1.5">{SOURCE_LABEL[row.source] ?? row.source}</Badge>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.category.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-(--text-secondary)">{row.club?.name ?? ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-(--color-success)">{isIncome ? formatWon(row.amount) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-(--color-danger)">{!isIncome ? formatWon(row.amount) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatWon(row.balance)}</td>
                  <td className="px-3 py-2 text-(--text-muted) max-w-[12rem] truncate">{row.memo ?? ''}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button type="button" onClick={() => setEditing(row)} className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--text-muted)" aria-label={`${row.description} 수정`}><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setDeleting(row)} className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--color-danger)" aria-label={`${row.description} 삭제`}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              )
            })}
            {ledger.rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-(--text-muted)">이 달의 거래가 없습니다.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
              <td className="px-3 py-2.5" colSpan={4}>합계</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatWon(ledger.totalIncome)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatWon(ledger.totalExpense)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatWon(ledger.closingBalance)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 수정 모달 */}
      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title="거래 수정" size="xl">
        {editing && (
          <div className="p-5">
            <TransactionForm
              accountId={account.id}
              categories={ledger.categories}
              clubs={clubs}
              initial={{
                occurred_at: toDatetimeLocal(editing.occurred_at),
                category_id: editing.category_id,
                description: editing.description,
                amount: String(editing.amount),
                club_id: editing.club_id,
                memo: editing.memo ?? '',
              }}
              submitLabel="저장"
              onSubmit={(input: TransactionInput) => updateTransaction(editing.id, input)}
              onError={showError}
              onSuccess={() => { setEditing(null); showSuccess('거래가 수정되었습니다.') }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="거래 삭제"
        message={`${deleting?.description} (${formatWon(deleting?.amount ?? 0)}원) 거래를 삭제하시겠습니까? 이후 잔액이 다시 계산됩니다.`}
        type="error"
        confirmText="삭제"
        isLoading={deleteBusy}
      />
      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type="success" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type="error" />
    </div>
  )
}

function Row({ label, value, bold, muted, danger }: { label: string; value: number; bold?: boolean; muted?: boolean; danger?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold pt-1.5 border-t border-(--border-color)' : ''}`}>
      <span className={muted ? 'text-(--text-muted)' : 'text-(--text-secondary)'}>{label}</span>
      <span className={`tabular-nums ${danger ? 'text-(--color-danger)' : 'text-(--text-primary)'}`}>{formatWon(value)}</span>
    </div>
  )
}
