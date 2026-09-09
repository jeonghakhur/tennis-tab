'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import type { AccountAnnualSummary, BudgetReportRow } from '@/lib/finance/types'
import { formatWon } from '@/lib/finance/ledger'
import { Badge } from '@/components/common/Badge'

interface Props {
  year: number
  currentYear: number
  summaries: AccountAnnualSummary[]
  budgets: BudgetReportRow[]
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`)

/** 연간 대시보드: 계정 카드 + 월별 수지 표 + 분류 합계 + 예산 달성률 */
export function FinanceOverview({ year, currentYear, summaries, budgets }: Props) {
  const router = useRouter()
  const goYear = (y: number) => router.push(`/admin/finance?year=${y}`)

  return (
    <div className="space-y-8">
      {/* 연도 이동 */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => goYear(year - 1)} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)" aria-label="이전 연도">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xl font-bold text-(--text-primary)">{year}년</span>
        <button type="button" onClick={() => goYear(year + 1)} disabled={year >= currentYear} className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary) disabled:opacity-40" aria-label="다음 연도">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 계정 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaries.map((s) => {
          const closing = s.months[11]?.balance ?? s.openingBalance
          return (
            <Link key={s.account.id} href={`/admin/finance/${s.account.id}?year=${year}`} className="glass-card rounded-xl p-5 space-y-3 block hover:opacity-90 transition-opacity">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-(--text-primary)">{s.account.name}</h3>
                <ArrowRight className="w-4 h-4 text-(--text-muted)" />
              </div>
              <p className="text-2xl font-bold text-(--text-primary)">{formatWon(closing)}<span className="text-sm font-normal text-(--text-muted) ml-1">원</span></p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-(--text-muted)">수입</p><p className="font-semibold text-(--color-success)">{formatWon(s.totalIncome)}</p></div>
                <div><p className="text-(--text-muted)">지출</p><p className="font-semibold text-(--color-danger)">{formatWon(s.totalExpense)}</p></div>
              </div>
              <p className="text-sm text-(--text-muted)">이월 {formatWon(s.openingBalance)} · 순이익 {formatWon(s.totalIncome - s.totalExpense)}</p>
            </Link>
          )
        })}
        {summaries.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center text-(--text-muted) md:col-span-3">
            통장이 없습니다. 마이그레이션(60_finance_ledger.sql)이 적용되었는지 확인해주세요.
          </div>
        )}
      </div>

      {/* 계정별 월별 수지 */}
      {summaries.map((s) => (
        <section key={s.account.id} className="space-y-3">
          <h2 className="text-lg font-semibold text-(--text-primary)">{s.account.name} 월별 수지</h2>
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-(--text-muted) border-b border-(--border-color)">
                  <th className="text-left px-4 py-2.5 font-medium">월</th>
                  <th className="text-right px-4 py-2.5 font-medium">수입</th>
                  <th className="text-right px-4 py-2.5 font-medium">지출</th>
                  <th className="text-right px-4 py-2.5 font-medium">순이익</th>
                  <th className="text-right px-4 py-2.5 font-medium">잔액</th>
                </tr>
              </thead>
              <tbody>
                {s.months.map((m) => {
                  const empty = m.income === 0 && m.expense === 0
                  return (
                    <tr key={m.month} className={`border-b border-(--border-color)/50 ${empty ? 'text-(--text-muted)' : 'text-(--text-primary)'}`}>
                      <td className="px-4 py-2">
                        <Link href={`/admin/finance/${s.account.id}?year=${year}&month=${m.month}`} className="hover:underline">{MONTH_LABELS[m.month - 1]}</Link>
                      </td>
                      <td className="text-right px-4 py-2 tabular-nums">{formatWon(m.income)}</td>
                      <td className="text-right px-4 py-2 tabular-nums">{formatWon(m.expense)}</td>
                      <td className={`text-right px-4 py-2 tabular-nums ${m.net < 0 ? 'text-(--color-danger)' : ''}`}>{formatWon(m.net)}</td>
                      <td className="text-right px-4 py-2 tabular-nums font-semibold">{formatWon(m.balance)}</td>
                    </tr>
                  )
                })}
                <tr className="font-bold text-(--text-primary) bg-(--bg-secondary)/50">
                  <td className="px-4 py-2.5">합계</td>
                  <td className="text-right px-4 py-2.5 tabular-nums">{formatWon(s.totalIncome)}</td>
                  <td className="text-right px-4 py-2.5 tabular-nums">{formatWon(s.totalExpense)}</td>
                  <td className="text-right px-4 py-2.5 tabular-nums">{formatWon(s.totalIncome - s.totalExpense)}</td>
                  <td className="text-right px-4 py-2.5 tabular-nums">{formatWon(s.months[11]?.balance ?? s.openingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 분류별 연간 합계 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['INCOME', 'EXPENSE'] as const).map((kind) => (
              <div key={kind} className="glass-card rounded-xl p-4">
                <p className="text-sm font-semibold mb-2 text-(--text-primary)">{kind === 'INCOME' ? '수입 분류' : '지출 분류'}</p>
                <ul className="space-y-1 text-sm">
                  {s.subtotals.filter((st) => st.kind === kind).map((st) => (
                    <li key={st.category_id} className="flex justify-between">
                      <span className="text-(--text-secondary)">{st.name}</span>
                      <span className="tabular-nums text-(--text-primary)">{formatWon(st.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* 예산 대비 실적 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--text-primary)">{year}년 운영계획 대비 실적</h2>
          <Link href="/admin/finance/settings#budgets" className="text-sm text-(--accent-color) hover:underline">예산 편집</Link>
        </div>
        {budgets.length === 0 ? (
          <p className="text-sm text-(--text-muted)">등록된 운영계획이 없습니다. 설정에서 항목과 계획 금액을 등록하세요.</p>
        ) : (
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-(--text-muted) border-b border-(--border-color)">
                  <th className="text-left px-4 py-2.5 font-medium">구분</th>
                  <th className="text-right px-4 py-2.5 font-medium">계획</th>
                  <th className="text-right px-4 py-2.5 font-medium">실적</th>
                  <th className="text-right px-4 py-2.5 font-medium">달성률</th>
                  <th className="text-left px-4 py-2.5 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} className="border-b border-(--border-color)/50 text-(--text-primary)">
                    <td className="px-4 py-2">
                      <Badge variant={b.kind === 'INCOME' ? 'success' : 'secondary'} className="mr-2">{b.kind === 'INCOME' ? '수입' : '지출'}</Badge>
                      {b.label}
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums">{formatWon(b.planned_amount)}</td>
                    <td className="text-right px-4 py-2 tabular-nums">{formatWon(b.actual_amount)}</td>
                    <td className="text-right px-4 py-2 tabular-nums">{b.achievement === null ? '-' : `${b.achievement}%`}</td>
                    <td className="px-4 py-2 text-(--text-muted)">{b.memo ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
