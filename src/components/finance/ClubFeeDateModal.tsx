'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { setClubFeePaidAt } from '@/lib/clubs/feeActions'
import { CLUB_ANNUAL_FEE_AMOUNT } from '@/lib/clubs/fee'
import { formatWon } from '@/lib/finance/ledger'
import { toDatetimeLocal } from './TransactionForm'

export interface ClubFeeDateTarget {
  clubId: string
  clubName: string
  year: number
  /** 현재 납부일 (미납이면 null) */
  paidAt: string | null
}

interface Props {
  target: ClubFeeDateTarget | null
  onClose: () => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}

/** 기본 납부일 — 기존 납부일, 없으면 올해면 지금·아니면 그 해 1월 1일 정오 */
function defaultDate(year: number, paidAt: string | null): string {
  if (paidAt) return toDatetimeLocal(paidAt)
  const now = new Date()
  return toDatetimeLocal((now.getFullYear() === year ? now : new Date(year, 0, 1, 12, 0)).toISOString())
}

/** 협회비 납부일 수정 — 금액은 고정, 원장과 무관하게 club_fee_payments 만 갱신 */
export function ClubFeeDateModal({ target, onClose, onChanged, onError }: Props) {
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) setDate(defaultDate(target.year, target.paidAt))
  }, [target])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    if (!date) return onError('납부일을 입력해주세요.')
    setSaving(true)
    const r = await setClubFeePaidAt(target.clubId, target.year, new Date(date).toISOString())
    setSaving(false)
    if (r.error) return onError(r.error)
    onChanged(`${target.clubName} ${target.year}년 협회비 납부일이 저장되었습니다.`)
    onClose()
  }

  return (
    <Modal
      isOpen={target !== null}
      onClose={onClose}
      title={target ? `${target.clubName} · ${target.year}년 협회비` : ''}
      description={`협회비는 클럽별 ${formatWon(CLUB_ANNUAL_FEE_AMOUNT)}원 고정이며 통장 원장에는 기록되지 않습니다.`}
      size="sm"
    >
      <Modal.Body>
        <form onSubmit={handleSave} noValidate className="space-y-3">
          <div>
            <label htmlFor="cf-date" className="block text-sm text-(--text-muted) mb-1">납부일</label>
            <input id="cf-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input-field text-sm" />
          </div>
          <p className="text-sm text-(--text-muted)">{target?.paidAt ? '저장하면 납부일이 변경됩니다.' : '저장하면 납부 처리됩니다.'}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">취소</button>
            <button type="submit" disabled={saving} className="btn-primary btn-sm"><span className="relative z-10">{saving ? '저장 중...' : '저장'}</span></button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  )
}
