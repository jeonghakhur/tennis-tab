'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ClubPaymentRow } from '@/lib/finance/types'
import type { ClubPaymentKind } from '@/lib/finance/actions'
import { formatWon } from '@/lib/finance/ledger'
import { formatKoreanDate } from '@/lib/utils/formatDate'
import { Badge } from '@/components/common/Badge'

interface Props {
  year: number
  kind: ClubPaymentKind
  rows: ClubPaymentRow[]
}

const KIND_LABEL: Record<ClubPaymentKind, string> = { COURT_FEE: '월 임대료(코트비)', DEV_FUND: '발전기금', ANNUAL_FEE: '협회비' }
const SLOT_ORDER = ['조기', '주중오전', '주중오후', '주중1회', '주말1회', '주말오전', '주말오후', '주말오전,오후']

/** 클럽 × 월 납부 매트릭스 — 시간대 그룹별, 미납(0) 강조 */
export function ClubPaymentMatrix({ year, kind, rows }: Props) {
  const href = (y: number, k: ClubPaymentKind) => `/admin/finance/clubs?year=${y}&kind=${k}`
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12

  // 시간대 그룹 정렬 (없는 그룹은 마지막)
  const sorted = [...rows].sort((a, b) => {
    const ia = a.court_slot ? SLOT_ORDER.indexOf(a.court_slot) : 99
    const ib = b.court_slot ? SLOT_ORDER.indexOf(b.court_slot) : 99
    if (ia !== ib) return (ia === -1 ? 98 : ia) - (ib === -1 ? 98 : ib)
    return a.club_name.localeCompare(b.club_name, 'ko')
  })
  const monthTotals = Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + r.months[i], 0))
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0)
  const isAnnualFee = kind === 'ANNUAL_FEE'
  const paidCount = rows.filter((r) => r.fee_paid).length

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

      <div className="glass-card rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-(--text-muted) border-b border-(--border-color)">
              <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-(--bg-card)">구분</th>
              <th className="text-left px-3 py-2.5 font-medium">클럽</th>
              {isAnnualFee && <th className="text-left px-3 py-2.5 font-medium">납부</th>}
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
                  {isAnnualFee && (
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Badge variant={r.fee_paid ? 'success' : 'warning'}>{r.fee_paid ? '납부' : '미납'}</Badge>
                      {r.fee_paid_at && <span className="ml-1.5 text-sm text-(--text-muted)">{formatKoreanDate(r.fee_paid_at)}</span>}
                    </td>
                  )}
                  {r.months.map((amt, i) => {
                    const unpaid = !isAnnualFee && amt === 0 && i + 1 <= currentMonth && !!r.court_slot
                    return (
                      <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${unpaid ? 'bg-(--color-warning-subtle) text-(--color-warning)' : amt === 0 ? 'text-(--text-muted)' : ''}`}>
                        {amt === 0 ? (unpaid ? '미납' : '-') : formatWon(amt)}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{formatWon(r.total)}</td>
                </tr>
              )
            })}
            {sorted.length === 0 && <tr><td colSpan={isAnnualFee ? 16 : 15} className="px-3 py-8 text-center text-(--text-muted)">집계할 거래가 없습니다. 원장에서 거래에 클럽을 연결해주세요.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
              <td className="px-3 py-2 sticky left-0 bg-(--bg-secondary)" colSpan={2}>합계</td>
              {isAnnualFee && <td className="px-3 py-2 whitespace-nowrap">납부 {paidCount} / {rows.length}</td>}
              {monthTotals.map((t, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{formatWon(t)}</td>)}
              <td className="px-3 py-2 text-right tabular-nums">{formatWon(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-(--text-muted)">
        {isAnnualFee
          ? '납부 여부는 클럽 관리의 연회비 스위치(club_fee_payments) 기준이고, 월별 금액은 협회통장 "협회비" 거래 중 클럽이 연결된 것만 집계됩니다. 엑셀에서 가져온 협회비 입금은 클럽이 연결된 경우에만 표시됩니다.'
          : '"미납"은 코트 시간대가 등록된 클럽이 이번 달까지 해당 월 거래가 없을 때 표시됩니다. 두 달치를 한 번에 낸 경우 해당 월에 합산되어 나타납니다.'}
      </p>
    </div>
  )
}
