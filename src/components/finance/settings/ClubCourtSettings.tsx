'use client'

import { useState } from 'react'
import type { ClubOption } from '@/lib/finance/actions'
import { updateClubCourtSettings } from '@/lib/finance/actions'
import { COURT_SLOTS } from '@/lib/finance/types'
import { formatWon } from '@/lib/finance/ledger'

interface Props {
  clubs: ClubOption[]
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

/** 숫자만 남기고 천 단위 콤마 표기 */
function formatFeeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/** 콤마 입력 문자열 → 정수 또는 null(빈 값) */
function parseFeeInput(value: string): number | null {
  return value ? Number(value.replace(/,/g, '')) : null
}

/** 저장된 금액 → 입력 표시 문자열 */
function toFeeInput(amount: number | null): string {
  return amount !== null ? formatFeeInput(String(amount)) : ''
}

interface RowProps {
  club: ClubOption
  onError: (m: string) => void
  onSuccess: (m: string) => void
}

/** 클럽 한 행 — 코트 시간대 select + 월 코트비 입력 + 저장 */
function ClubCourtRow({ club, onError, onSuccess }: RowProps) {
  const [slot, setSlot] = useState(club.court_slot ?? '')
  const [fee, setFee] = useState(toFeeInput(club.monthly_court_fee))
  const [devFund, setDevFund] = useState(toFeeInput(club.monthly_dev_fund))
  const [saving, setSaving] = useState(false)

  const feeNumber = parseFeeInput(fee)
  const devFundNumber = parseFeeInput(devFund)
  const dirty =
    slot !== (club.court_slot ?? '') || feeNumber !== club.monthly_court_fee || devFundNumber !== club.monthly_dev_fund

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    const r = await updateClubCourtSettings({ clubId: club.id, courtSlot: slot || null, monthlyCourtFee: feeNumber, monthlyDevFund: devFundNumber })
    setSaving(false)
    if (r.error) return onError(r.error)
    onSuccess(`${club.name} 코트 설정이 저장되었습니다.`)
  }

  const slotId = `club-slot-${club.id}`
  const feeId = `club-fee-${club.id}`
  const devFundId = `club-dev-fund-${club.id}`
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
  }

  return (
    <tr className="border-b border-(--border-color)/50 text-(--text-primary)">
      <td className="px-3 py-1.5 whitespace-nowrap font-medium">{club.name}</td>
      <td className="px-3 py-1.5">
        <label htmlFor={slotId} className="sr-only">{club.name} 코트 시간대</label>
        <select id={slotId} value={slot} onChange={(e) => setSlot(e.target.value)} className="input-field text-sm w-40">
          <option value="">미배정</option>
          {COURT_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <label htmlFor={feeId} className="sr-only">{club.name} 월 코트비</label>
        <input
          id={feeId}
          inputMode="numeric"
          value={fee}
          onChange={(e) => setFee(formatFeeInput(e.target.value))}
          placeholder="미설정"
          onKeyDown={onEnter}
          className="input-field text-sm text-right w-32"
        />
      </td>
      <td className="px-3 py-1.5">
        <label htmlFor={devFundId} className="sr-only">{club.name} 월 발전기금</label>
        <input
          id={devFundId}
          inputMode="numeric"
          value={devFund}
          onChange={(e) => setDevFund(formatFeeInput(e.target.value))}
          placeholder="미설정"
          onKeyDown={onEnter}
          className="input-field text-sm text-right w-32"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn-secondary btn-sm">
          {saving ? '저장 중...' : '저장'}
        </button>
      </td>
    </tr>
  )
}

/** 클럽 코트 설정 — 코트 시간대(매트릭스 그룹)와 월 코트비 기준 금액 */
export function ClubCourtSettings({ clubs, onError, onSuccess }: Props) {
  const totalFee = clubs.reduce((s, c) => s + (c.monthly_court_fee ?? 0), 0)
  const totalDevFund = clubs.reduce((s, c) => s + (c.monthly_dev_fund ?? 0), 0)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-(--text-primary)">클럽 코트 설정</h2>
      <p className="text-sm text-(--text-muted)">
        코트 시간대는 클럽 납부 현황의 그룹 구분에, 월 코트비·월 발전기금은 납부 입력 시 기본 금액과 현황표의 기준 컬럼에 사용됩니다. 비워두면 최근 납부 금액을 기본값으로 씁니다.
      </p>
      <div className="glass-card rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-(--text-muted) border-b border-(--border-color)">
              <th className="text-left px-3 py-2.5 font-medium">클럽</th>
              <th className="text-left px-3 py-2.5 font-medium">코트 시간대</th>
              <th className="text-left px-3 py-2.5 font-medium">월 코트비(원)</th>
              <th className="text-left px-3 py-2.5 font-medium">월 발전기금(원)</th>
              <th className="px-3 py-2.5"><span className="sr-only">저장</span></th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c) => <ClubCourtRow key={c.id} club={c} onError={onError} onSuccess={onSuccess} />)}
            {clubs.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-(--text-muted)">활성 클럽이 없습니다.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
              <td className="px-3 py-2" colSpan={2}>합계</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatWon(totalFee)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatWon(totalDevFund)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
