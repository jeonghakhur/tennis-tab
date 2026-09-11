'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { COURT_SLOTS, type ClubPaymentRow } from '@/lib/finance/types'
import type { ClubPaymentKind, MonthlyPaymentKind } from '@/lib/finance/actions'
import { formatWon } from '@/lib/finance/ledger'
import { formatKoreanDate } from '@/lib/utils/formatDate'
import { Badge } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ClubFeeToggle } from '@/components/clubs/ClubFeeToggle'
import { ClubPaymentModal, type ClubPaymentTarget } from './ClubPaymentModal'
import { ClubFeeDateModal, type ClubFeeDateTarget } from './ClubFeeDateModal'
import { CLUB_ANNUAL_FEE_AMOUNT } from '@/lib/clubs/fee'

interface Props {
  year: number
  kind: ClubPaymentKind
  rows: ClubPaymentRow[]
}

const KIND_LABEL: Record<ClubPaymentKind, string> = { COURT_FEE: '월 임대료(코트비)', DEV_FUND: '발전기금', ANNUAL_FEE: '협회비(연 1회)' }
const ANNUAL_FEE_LABEL = `${formatWon(CLUB_ANNUAL_FEE_AMOUNT)}원`
const SLOT_ORDER: readonly string[] = COURT_SLOTS

/** 클럽 × 월 납부 매트릭스 — 셀 클릭으로 수동 입력·삭제. 협회비는 연 1회 고정 금액, 원장 미연동 */
export function ClubPaymentMatrix({ year, kind, rows }: Props) {
  const router = useRouter()
  const [target, setTarget] = useState<ClubPaymentTarget | null>(null)
  const [feeTarget, setFeeTarget] = useState<ClubFeeDateTarget | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const href = (y: number, k: ClubPaymentKind) => `/admin/finance/clubs?year=${y}&kind=${k}`
  const isAnnualFee = kind === 'ANNUAL_FEE'
  /** 월별 탭의 기준 금액 컬럼 — 코트비/발전기금 (협회비는 없음) */
  const baseAmountOf = (r: ClubPaymentRow): number | null => {
    if (kind === 'COURT_FEE') return r.monthly_court_fee
    if (kind === 'DEV_FUND') return r.monthly_dev_fund
    return null
  }
  const baseLabel = kind === 'COURT_FEE' ? '월 코트비' : '월 발전기금'
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12

  const sorted = [...rows].sort((a, b) => {
    const ia = a.court_slot ? SLOT_ORDER.indexOf(a.court_slot) : 99
    const ib = b.court_slot ? SLOT_ORDER.indexOf(b.court_slot) : 99
    if (ia !== ib) return (ia === -1 ? 98 : ia) - (ib === -1 ? 98 : ib)
    return a.club_name.localeCompare(b.club_name, 'ko')
  })
  const monthTotals = Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + r.months[i], 0))
  const grandTotal = isAnnualFee ? rows.reduce((s, r) => s + r.total, 0) : monthTotals.reduce((a, b) => a + b, 0)
  const baseAmountTotal = rows.reduce((s, r) => s + (baseAmountOf(r) ?? 0), 0)
  const paidCount = rows.filter((r) => r.fee_paid).length

  const onChanged = (message: string) => { setToast({ isOpen: true, message }); router.refresh() }
  const onError = (message: string) => setAlert({ isOpen: true, message })
  const open = (r: ClubPaymentRow, month: number) => {
    if (isAnnualFee) return
    setTarget({ clubId: r.club_id, clubName: r.club_name, kind: kind as MonthlyPaymentKind, year, month })
  }
  const openFeeDate = (r: ClubPaymentRow) => setFeeTarget({ clubId: r.club_id, clubName: r.club_name, year, paidAt: r.fee_paid_at ?? null })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-(--border-color)">
          {(['COURT_FEE', 'DEV_FUND', 'ANNUAL_FEE'] as const).map((k) => (
            <Link key={k} href={href(year, k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${k === kind ? 'border-(--accent-color) text-(--accent-color)' : 'border-transparent text-(--text-muted) hover:text-(--text-primary)'}`}>
              {KIND_LABEL[k]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={href(year - 1, kind)} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="이전 연도"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="text-lg font-bold text-(--text-primary)">{year}년</span>
          <Link href={href(year + 1, kind)} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="다음 연도"><ChevronRight className="w-5 h-5" /></Link>
        </div>
      </div>

      {isAnnualFee ? (
        /* ---------- 협회비: 연 1회 ---------- */
        <div className="glass-card rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-(--text-muted) border-b border-(--border-color)">
                <th className="text-left px-3 py-2.5 font-medium">클럽</th>
                <th className="text-left px-3 py-2.5 font-medium">납부</th>
                <th className="text-left px-3 py-2.5 font-medium">납부일</th>
                <th className="text-right px-3 py-2.5 font-medium">협회비</th>
                <th className="px-3 py-2.5"><span className="sr-only">납부일 수정</span></th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => a.club_name.localeCompare(b.club_name, 'ko')).map((r) => (
                <tr key={r.club_id} className="border-b border-(--border-color)/50 text-(--text-primary)">
                  <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.club_name}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <ClubFeeToggle clubId={r.club_id} year={year} paid={!!r.fee_paid} ariaLabel={`${r.club_name} ${year}년 협회비 납부`} onSaved={(paid) => onChanged(paid ? `${r.club_name} 협회비 납부 처리` : `${r.club_name} 미납으로 변경`)} onError={onError} />
                      <Badge variant={r.fee_paid ? 'success' : 'warning'}>{r.fee_paid ? '납부' : '미납'}</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-(--text-secondary) whitespace-nowrap">{r.fee_paid_at ? formatKoreanDate(r.fee_paid_at) : '-'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.fee_paid ? ANNUAL_FEE_LABEL : <span className="text-(--text-muted)">-</span>}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" onClick={() => openFeeDate(r)} className="btn-secondary btn-sm">{r.fee_paid ? '납부일 수정' : '납부일 지정'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2" colSpan={2}>납부 {paidCount} / {rows.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatWon(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ---------- 코트비 / 발전기금: 월별 ---------- */
        <div className="glass-card rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-(--text-muted) border-b border-(--border-color)">
                <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-(--bg-card)">구분</th>
                <th className="text-left px-3 py-2.5 font-medium">클럽</th>
                <th className="text-right px-2 py-2.5 font-medium whitespace-nowrap">{baseLabel}</th>
                {Array.from({ length: 12 }, (_, i) => <th key={i} className="text-right px-2 py-2.5 font-medium">{i + 1}월</th>)}
                <th className="text-right px-3 py-2.5 font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const showSlot = idx === 0 || sorted[idx - 1].court_slot !== r.court_slot
                return (
                  <tr key={r.club_id} className="border-b border-(--border-color)/50 text-(--text-primary)">
                    <td className="px-3 py-1.5 text-(--text-muted) whitespace-nowrap sticky left-0 bg-(--bg-card)">{showSlot ? (r.court_slot ?? '기타') : ''}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.club_name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-(--text-secondary)">
                      {baseAmountOf(r) !== null ? formatWon(baseAmountOf(r) ?? 0) : <span className="text-(--text-muted)">-</span>}
                    </td>
                    {r.months.map((amt, i) => {
                      const unpaid = amt === 0 && i + 1 <= currentMonth && !!r.court_slot
                      return (
                        <td key={i} className={`p-0 text-right tabular-nums ${unpaid ? 'bg-(--color-warning-subtle)' : ''}`}>
                          <button
                            type="button"
                            onClick={() => open(r, i + 1)}
                            className={`w-full h-full px-2 py-1.5 text-right hover:bg-(--accent-color)/10 transition-colors ${unpaid ? 'text-(--color-warning)' : amt === 0 ? 'text-(--text-muted)' : ''}`}
                            aria-label={`${r.club_name} ${i + 1}월 ${amt ? formatWon(amt) + '원' : '미입력'} — 클릭하여 입력`}
                          >
                            {amt === 0 ? (unpaid ? '미납' : '-') : formatWon(amt)}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{formatWon(r.total)}</td>
                  </tr>
                )
              })}
              {sorted.length === 0 && <tr><td colSpan={16} className="px-3 py-8 text-center text-(--text-muted)">표시할 클럽이 없습니다. <Link href="/admin/finance/settings" className="underline">재정 설정</Link>에서 클럽 코트 시간대를 등록하거나 원장에서 거래에 클럽을 연결하세요.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
                <td className="px-3 py-2 sticky left-0 bg-(--bg-secondary)" colSpan={2}>합계</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatWon(baseAmountTotal)}</td>
                {monthTotals.map((t, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{formatWon(t)}</td>)}
                <td className="px-3 py-2 text-right tabular-nums">{formatWon(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-sm text-(--text-muted)">
        {isAnnualFee
          ? `협회비는 클럽별 ${ANNUAL_FEE_LABEL} 연 1회 고정이며 통장 원장에는 기록되지 않습니다. 스위치로 납부 여부를, "납부일 수정"으로 날짜를 바꿀 수 있습니다. 클럽 관리 화면의 연회비 스위치와 같은 데이터입니다.`
          : '셀을 클릭하면 해당 달의 납부 기록을 보고 직접 입력·삭제할 수 있습니다. "미납"은 코트 시간대가 등록된 클럽이 이번 달까지 기록이 없을 때 표시됩니다. 입력한 금액은 원장 거래로 저장됩니다. 월 코트비·월 발전기금 기준 금액과 코트 시간대는 재정 설정에서 입력합니다.'}
      </p>

      <ClubPaymentModal target={target} onClose={() => setTarget(null)} onChanged={onChanged} onError={onError} />
      <ClubFeeDateModal target={feeTarget} onClose={() => setFeeTarget(null)} onChanged={onChanged} onError={onError} />
      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type="success" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type="error" />
    </div>
  )
}
