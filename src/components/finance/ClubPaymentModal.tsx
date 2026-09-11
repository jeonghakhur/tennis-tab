'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import type { ClubPaymentDetail } from '@/lib/finance/types'
import { getClubPaymentDetail, addClubPayment, deleteClubPayment, type MonthlyPaymentKind } from '@/lib/finance/actions'
import { formatWon } from '@/lib/finance/ledger'
import { formatKoreanDate } from '@/lib/utils/formatDate'
import { toDatetimeLocal } from './TransactionForm'

export interface ClubPaymentTarget {
  clubId: string
  clubName: string
  kind: MonthlyPaymentKind
  year: number
  month: number
}

interface Props {
  target: ClubPaymentTarget | null
  onClose: () => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}

const KIND_LABEL: Record<MonthlyPaymentKind, string> = { COURT_FEE: '코트비', DEV_FUND: '발전기금' }
const SOURCE_LABEL: Record<string, string> = { IMPORT: '가져옴', MANUAL: '수동', TOSS: '토스' }

/** 셀 기본 날짜: 이번 달이면 오늘, 아니면 그 달 1일 정오 */
function defaultDate(year: number, month: number): string {
  const now = new Date()
  const same = now.getFullYear() === year && now.getMonth() + 1 === month
  return toDatetimeLocal((same ? now : new Date(year, month - 1, 1, 12, 0)).toISOString())
}

/** 클럽 × 항목 × 월 납부 상세 — 기존 거래 목록 + 수동 입력 (코트비·발전기금) */
export function ClubPaymentModal({ target, onClose, onChanged, onError }: Props) {
  const [detail, setDetail] = useState<ClubPaymentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ClubPaymentDetail['transactions'][number] | null>(null)

  const load = async (t: ClubPaymentTarget) => {
    setLoading(true)
    const r = await getClubPaymentDetail(t.clubId, t.kind, t.year, t.month)
    setLoading(false)
    if (r.error || !r.data) {
      onError(r.error ?? '조회에 실패했습니다.')
      onClose()
      return
    }
    setDetail(r.data)
    setAmount(r.data.suggestedAmount ? String(r.data.suggestedAmount) : '')
  }

  useEffect(() => {
    if (!target) { setDetail(null); return }
    setDate(defaultDate(target.year, target.month))
    setMemo('')
    load(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    const n = Number(amount.replace(/,/g, ''))
    if (!Number.isInteger(n) || n <= 0) return onError('금액은 1원 이상의 정수로 입력해주세요.')
    if (!date) return onError('납부일을 입력해주세요.')
    setSaving(true)
    const r = await addClubPayment({ clubId: target.clubId, kind: target.kind, occurredAt: new Date(date).toISOString(), amount: n, memo })
    setSaving(false)
    if (r.error) return onError(r.error)
    onChanged(`${target.clubName} ${KIND_LABEL[target.kind]} ${formatWon(n)}원이 저장되었습니다.`)
    await load(target)
    setMemo('')
  }

  const handleDelete = async () => {
    if (!deleting || !target) return
    const r = await deleteClubPayment(deleting.id)
    setDeleting(null)
    if (r.error) return onError(r.error)
    onChanged('납부 기록이 삭제되었습니다.')
    await load(target)
  }

  const title = target ? `${target.clubName} · ${target.month}월 ${KIND_LABEL[target.kind]}` : ''
  const total = detail?.transactions.reduce((s, t) => s + t.amount, 0) ?? 0

  return (
    <>
      <Modal isOpen={target !== null} onClose={onClose} title={title} description="입력한 금액은 원장 거래로 저장되어 통장 잔액에 반영됩니다." size="md">
        <Modal.Body>
          <div className="space-y-4">
            {/* 기존 거래 */}
            <div>
              <p className="text-sm font-medium text-(--text-muted) mb-2">납부 기록 {detail ? `(${detail.transactions.length}건 · ${formatWon(total)}원)` : ''}</p>
              {loading ? (
                <div className="h-12 rounded-lg animate-pulse bg-(--bg-card-hover)" />
              ) : detail && detail.transactions.length > 0 ? (
                <ul className="space-y-1.5">
                  {detail.transactions.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--bg-card-hover) text-sm">
                      <span className="text-(--text-secondary) whitespace-nowrap">{formatKoreanDate(t.occurred_at)}</span>
                      <span className="flex-1 truncate text-(--text-primary)">{t.description}{t.memo ? <span className="text-(--text-muted)"> · {t.memo}</span> : null}</span>
                      <span className="text-(--text-muted)">{SOURCE_LABEL[t.source] ?? t.source}</span>
                      <span className="tabular-nums font-semibold text-(--text-primary)">{formatWon(t.amount)}</span>
                      <button type="button" onClick={() => setDeleting(t)} className="p-1 rounded hover:bg-(--bg-secondary) text-(--color-danger)" aria-label={`${formatKoreanDate(t.occurred_at)} ${formatWon(t.amount)}원 삭제`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-(--text-muted)">납부 기록이 없습니다.</p>
              )}
            </div>

            {/* 입력 */}
            <form onSubmit={handleAdd} noValidate className="space-y-3 pt-3 border-t border-(--border-color)">
              <p className="text-sm font-medium text-(--text-muted)">납부 추가</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cp-date" className="block text-sm text-(--text-muted) mb-1">납부일</label>
                  <input id="cp-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label htmlFor="cp-amount" className="block text-sm text-(--text-muted) mb-1">금액(원)</label>
                  <input id="cp-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} className="input-field text-sm text-right" />
                </div>
              </div>
              <div>
                <label htmlFor="cp-memo" className="block text-sm text-(--text-muted) mb-1">비고</label>
                <input id="cp-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} placeholder="예: 두 달치 합산" className="input-field text-sm" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving || loading} className="btn-primary btn-sm"><span className="relative z-10">{saving ? '저장 중...' : '저장'}</span></button>
              </div>
            </form>
          </div>
        </Modal.Body>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="납부 기록 삭제"
        message={`${deleting ? formatKoreanDate(deleting.occurred_at) : ''} ${formatWon(deleting?.amount ?? 0)}원 기록을 삭제하시겠습니까? 원장에서도 함께 삭제됩니다.`}
        type="error"
        confirmText="삭제"
      />
    </>
  )
}
