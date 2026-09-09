'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { FinanceAccount, FinanceCategory, AccountType, CategoryKind } from '@/lib/finance/types'
import { ACCOUNT_TYPE_LABELS } from '@/lib/finance/types'
import type { ParseResult } from '@/lib/finance/excelImport'
import { commitImport, type ClubOption, type ImportTransactionRow } from '@/lib/finance/actions'
import { formatWon } from '@/lib/finance/ledger'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { ClubCombobox } from './ClubCombobox'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  clubs: ClubOption[]
  aliases: Array<{ alias: string; club_id: string; club_name: string }>
}

type Step = 'upload' | 'map' | 'done'
/** "accountType:kind:rawCategory" → category_id */
type CategoryMap = Record<string, string>
/** clubHint → club_id | '' (연결 안 함) */
type ClubMap = Record<string, string>

const catKey = (accountType: AccountType, kind: CategoryKind, raw: string) => `${accountType}:${kind}:${raw}`

/** 결산서 엑셀 → 파싱 → 분류·클럽 매핑 → 확정 */
export function ImportWizard({ accounts, categories, clubs, aliases }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({})
  const [clubMap, setClubMap] = useState<ClubMap>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const accountByType = useMemo(() => Object.fromEntries(accounts.map((a) => [a.account_type, a])) as Record<AccountType, FinanceAccount | undefined>, [accounts])
  const clubByName = useMemo(() => new Map(clubs.map((c) => [c.name, c.id])), [clubs])
  const aliasMap = useMemo(() => new Map(aliases.map((a) => [a.alias, a.club_id])), [aliases])

  /** 파싱 결과의 분류·클럽 힌트 집합 (매핑 UI용) */
  const distinct = useMemo(() => {
    if (!parsed) return { cats: [] as Array<{ key: string; accountType: AccountType; kind: CategoryKind; raw: string; count: number }>, hints: [] as Array<{ hint: string; count: number }> }
    const cats = new Map<string, { key: string; accountType: AccountType; kind: CategoryKind; raw: string; count: number }>()
    const hints = new Map<string, number>()
    for (const t of parsed.transactions) {
      const k = catKey(t.accountType, t.kind, t.rawCategory)
      const c = cats.get(k)
      if (c) c.count++
      else cats.set(k, { key: k, accountType: t.accountType, kind: t.kind, raw: t.rawCategory, count: 1 })
      if (t.clubHint) hints.set(t.clubHint, (hints.get(t.clubHint) ?? 0) + 1)
    }
    return {
      cats: [...cats.values()].sort((a, b) => a.key.localeCompare(b.key)),
      hints: [...hints.entries()].map(([hint, count]) => ({ hint, count })).sort((a, b) => b.count - a.count),
    }
  }, [parsed])

  const handleFile = async (file: File) => {
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/finance/import/parse', { method: 'POST', body: fd })
      const text = await res.text()
      let json: (ParseResult & { error?: string }) | null = null
      try { json = JSON.parse(text) } catch { json = null }
      if (!res.ok || !json || json.error) {
        setAlert({ isOpen: true, message: json?.error ?? `파싱에 실패했습니다. (HTTP ${res.status})` })
        return
      }
      if (json.transactions.length === 0) {
        setAlert({ isOpen: true, message: '읽을 수 있는 거래가 없습니다. 시트 이름이 "1월"~"12월", "협회1월"~"협회12월", "이사회비" 형식인지 확인해주세요.' })
        return
      }
      setParsed(json)
      // 자동 매핑: 분류명 일치 / 클럽명·별칭 일치
      const cm: CategoryMap = {}
      for (const t of json.transactions) {
        const k = catKey(t.accountType, t.kind, t.rawCategory)
        if (cm[k] !== undefined) continue
        const acc = accountByType[t.accountType]
        const options = acc ? categories.filter((c) => c.account_id === acc.id && c.kind === t.kind) : []
        const exact = options.find((c) => c.name === t.rawCategory)
        // 협회통장 수입에 대회명(…대회/…배)이 오면 '대회수입'으로, 그 외 미일치는 수동 지정
        const tournamentIncome =
          !exact && t.accountType === 'ASSOCIATION' && t.kind === 'INCOME' && /(대회|배)$/.test(t.rawCategory)
            ? options.find((c) => c.name === '대회수입')
            : undefined
        cm[k] = (exact ?? tournamentIncome)?.id ?? ''
      }
      const clm: ClubMap = {}
      for (const t of json.transactions) {
        if (!t.clubHint || clm[t.clubHint] !== undefined) continue
        clm[t.clubHint] = clubByName.get(t.clubHint) ?? aliasMap.get(t.clubHint) ?? ''
      }
      setCategoryMap(cm)
      setClubMap(clm)
      setStep('map')
    } catch {
      setAlert({ isOpen: true, message: '업로드 중 오류가 발생했습니다.' })
    } finally {
      setParsing(false)
    }
  }

  const unmappedCats = distinct.cats.filter((c) => !categoryMap[c.key])
  const missingAccounts = [...new Set((parsed?.transactions ?? []).map((t) => t.accountType))].filter((t) => !accountByType[t])

  const buildRows = (): ImportTransactionRow[] =>
    (parsed?.transactions ?? []).map((t) => ({
      account_id: accountByType[t.accountType]!.id,
      category_id: categoryMap[catKey(t.accountType, t.kind, t.rawCategory)],
      occurred_at: t.occurredAt,
      description: t.description,
      amount: t.amount,
      memo: t.memo,
      club_id: t.clubHint ? clubMap[t.clubHint] || null : null,
      import_key: t.importKey,
    }))

  const handleCommit = async () => {
    setConfirmOpen(false)
    setCommitting(true)
    const r = await commitImport(buildRows())
    setCommitting(false)
    if (r.error) {
      setAlert({ isOpen: true, message: r.error })
      return
    }
    setResult({ inserted: r.inserted ?? 0, skipped: r.skipped ?? 0 })
    setStep('done')
    setToast({ isOpen: true, message: `${r.inserted}건을 가져왔습니다.` })
    router.refresh()
  }

  const total = parsed?.transactions.length ?? 0
  const sumIncome = parsed?.transactions.filter((t) => t.kind === 'INCOME').reduce((a, t) => a + t.amount, 0) ?? 0
  const sumExpense = parsed?.transactions.filter((t) => t.kind === 'EXPENSE').reduce((a, t) => a + t.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      {(parsing || committing) && <LoadingOverlay message={parsing ? '엑셀을 분석하는 중...' : '거래를 저장하는 중...'} />}

      {/* Step 1: 업로드 */}
      {step === 'upload' && (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Upload className="w-12 h-12 mx-auto text-(--text-muted)" />
          <p className="text-(--text-primary) font-medium">월별수지결산서 .xlsx 파일을 선택하세요</p>
          <p className="text-sm text-(--text-muted)">시트 이름이 <code>1월</code>~<code>12월</code>, <code>협회1월</code>~<code>협회12월</code>, <code>이사회비</code>인 시트를 읽습니다. 이미 가져온 거래는 자동으로 건너뜁니다.</p>
          <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
            <span className="relative z-10">파일 선택</span>
            <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          </label>
        </div>
      )}

      {/* Step 2: 매핑 */}
      {step === 'map' && parsed && (
        <>
          <div className="glass-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="거래" value={`${total}건`} />
            <Stat label="수입 합계" value={formatWon(sumIncome)} />
            <Stat label="지출 합계" value={formatWon(sumExpense)} />
            <Stat label="건너뜀" value={`${parsed.skipped.length}행`} />
          </div>
          <p className="text-sm text-(--text-muted)">
            {parsed.sheetCounts.filter((s) => s.count > 0).map((s) => `${s.sheet} ${s.count}`).join(' · ')}
          </p>
          {missingAccounts.length > 0 && (
            <Warn>다음 통장이 설정에 없습니다: {missingAccounts.map((t) => ACCOUNT_TYPE_LABELS[t]).join(', ')}. 마이그레이션(60_finance_ledger.sql)이 적용되었는지 확인하세요.</Warn>
          )}

          {/* 분류 매핑 */}
          <section className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-(--text-primary)">분류 매핑 <span className="text-sm font-normal text-(--text-muted)">({distinct.cats.length}개, 미지정 {unmappedCats.length})</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {distinct.cats.map((c) => {
                const acc = accountByType[c.accountType]
                const options = categories.filter((cat) => acc && cat.account_id === acc.id && cat.kind === c.kind)
                const id = `cat-map-${c.key}`
                return (
                  <div key={c.key} className={`flex items-center gap-2 p-2 rounded-lg ${categoryMap[c.key] ? 'bg-(--bg-secondary)/50' : 'bg-subtle-warning'}`}>
                    <label htmlFor={id} className="flex-1 text-sm truncate">
                      <span className="text-(--text-muted)">{ACCOUNT_TYPE_LABELS[c.accountType]} · {c.kind === 'INCOME' ? '수입' : '지출'} · </span>
                      <span className="font-medium">{c.raw}</span>
                      <span className="text-(--text-muted)"> ({c.count})</span>
                    </label>
                    <select id={id} value={categoryMap[c.key] ?? ''} onChange={(e) => setCategoryMap({ ...categoryMap, [c.key]: e.target.value })} className="input-field text-sm w-44">
                      <option value="">선택</option>
                      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 클럽 매핑 */}
          <section className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-(--text-primary)">클럽 매핑 <span className="text-sm font-normal text-(--text-muted)">({distinct.hints.length}개 · 클럽이 아니면 비워두세요)</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {distinct.hints.map((h) => (
                <div key={h.hint} className="flex items-center gap-2 p-2 rounded-lg bg-(--bg-secondary)/50">
                  <span className="flex-1 text-sm truncate"><span className="font-medium">{h.hint}</span><span className="text-(--text-muted)"> ({h.count})</span></span>
                  <div className="w-52">
                    <ClubCombobox clubs={clubs} value={clubMap[h.hint] || null} onChange={(id) => setClubMap({ ...clubMap, [h.hint]: id ?? '' })} placeholder="연결 안 함" aria-label={`${h.hint} 클럽 연결`} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {parsed.skipped.length > 0 && (
            <details className="text-sm text-(--text-muted)">
              <summary className="cursor-pointer">건너뛴 행 {parsed.skipped.length}개 보기</summary>
              <ul className="mt-2 space-y-0.5">{parsed.skipped.map((s, i) => <li key={i}>{s.sheet} {s.rowNumber}행 — {s.reason}</li>)}</ul>
            </details>
          )}

          {unmappedCats.length > 0 && (
            <Warn>
              분류가 지정되지 않은 항목이 {unmappedCats.length}개 있습니다. 위 "분류 매핑"에서 노란색 항목의 분류를 모두 선택해야 가져오기가 활성화됩니다.
              {' '}
              <button type="button" onClick={() => document.getElementById(`cat-map-${unmappedCats[0].key}`)?.focus()} className="underline font-medium">첫 항목으로 이동</button>
            </Warn>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => { setParsed(null); setStep('upload') }} className="btn-secondary btn-sm">다른 파일 선택</button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={unmappedCats.length > 0 || missingAccounts.length > 0}
              title={unmappedCats.length > 0 ? `미지정 분류 ${unmappedCats.length}개를 먼저 선택하세요` : undefined}
              className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">{unmappedCats.length > 0 ? `미지정 분류 ${unmappedCats.length}개` : `${total}건 가져오기`}</span>
            </button>
          </div>
        </>
      )}

      {/* Step 3: 완료 */}
      {step === 'done' && result && (
        <div className="glass-card rounded-xl p-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-(--color-success)" />
          <p className="text-(--text-primary) font-medium">가져오기 완료</p>
          <p className="text-sm text-(--text-muted)">{result.inserted}건 저장, {result.skipped}건은 이미 있어 건너뜀</p>
          <div className="flex justify-center gap-2 pt-2">
            <button type="button" onClick={() => router.push('/admin/finance')} className="btn-primary btn-sm"><span className="relative z-10">재정 관리로 이동</span></button>
            <button type="button" onClick={() => { setParsed(null); setResult(null); setStep('upload') }} className="btn-secondary btn-sm">다른 파일 가져오기</button>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleCommit} title="거래 가져오기" message={`${total}건의 거래를 저장합니다. 이미 가져온 거래(같은 일시·적요·금액)는 자동으로 건너뜁니다. 진행할까요?`} type="info" confirmText="가져오기" />
      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type="success" />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type="error" />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-(--text-muted)">{label}</p><p className="font-semibold text-(--text-primary) tabular-nums">{value}</p></div>
}
function Warn({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-subtle-warning text-sm"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{children}</div>
}
