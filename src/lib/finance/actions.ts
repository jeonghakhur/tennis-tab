'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { sanitizeObject, validateTransactionInput, hasValidationErrors } from '@/lib/utils/validation'
import {
  buildMonthlyTotals,
  computeRunningBalances,
  getKSTMonthRange,
  getKSTYearRange,
  subtotalByCategory,
  sumByKind,
  toKSTParts,
  achievementRate,
} from './ledger'
import type {
  AccountAnnualSummary,
  BudgetReportRow,
  CategoryKind,
  ClubPaymentDetail,
  ClubPaymentRow,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceTransaction,
  MonthLedger,
  TransactionInput,
} from './types'

const TX_SELECT = '*, category:finance_categories!inner(name, kind), club:clubs(name)'

/** 시스템 ADMIN 이상 검증 */
async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const user = await getCurrentUser()
  if (!user || !hasMinimumRole(user.role, 'ADMIN')) {
    return { error: '재정 관리는 협회 관리자만 접근할 수 있습니다.' }
  }
  return { userId: user.id }
}

function revalidateFinance(accountId?: string) {
  revalidatePath('/admin/finance')
  revalidatePath('/admin/finance/clubs')
  revalidatePath('/admin/finance/settings')
  if (accountId) revalidatePath(`/admin/finance/${accountId}`)
}

// ============================================================================
// 계정
// ============================================================================

export async function getAccounts(includeInactive = false): Promise<FinanceAccount[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const admin = createAdminClient()
  let q = admin.from('finance_accounts').select('*').order('sort_order', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return (data ?? []) as FinanceAccount[]
}

export async function updateAccount(
  accountId: string,
  input: { name?: string; opening_balance?: number; opening_date?: string; is_active?: boolean }
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const sanitized = sanitizeObject(input)
  if (sanitized.name !== undefined && !sanitized.name.trim()) return { error: '통장 이름을 입력해주세요.' }
  if (sanitized.opening_balance !== undefined && !Number.isInteger(sanitized.opening_balance)) {
    return { error: '기초잔액은 정수(원)여야 합니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('finance_accounts').update(sanitized).eq('id', accountId)
  if (error) return { error: '통장 정보 수정에 실패했습니다.' }
  revalidateFinance(accountId)
  return {}
}

// ============================================================================
// 분류
// ============================================================================

export async function getCategories(accountId: string, includeInactive = false): Promise<FinanceCategory[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const admin = createAdminClient()
  let q = admin
    .from('finance_categories')
    .select('*')
    .eq('account_id', accountId)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return (data ?? []) as FinanceCategory[]
}

export async function createCategory(
  accountId: string,
  kind: CategoryKind,
  name: string
): Promise<{ error?: string; id?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const trimmed = sanitizeObject({ name }).name.trim()
  if (!trimmed || trimmed.length > 30) return { error: '분류 이름은 1~30자로 입력해주세요.' }

  const admin = createAdminClient()
  const { data: last } = await admin
    .from('finance_categories')
    .select('sort_order')
    .eq('account_id', accountId)
    .eq('kind', kind)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('finance_categories')
    .insert({ account_id: accountId, kind, name: trimmed, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { error: '같은 이름의 분류가 이미 있습니다.' }
    return { error: '분류 추가에 실패했습니다.' }
  }
  revalidateFinance(accountId)
  return { id: data.id }
}

export async function updateCategory(
  categoryId: string,
  input: { name?: string; sort_order?: number; is_active?: boolean }
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const sanitized = sanitizeObject(input)
  if (sanitized.name !== undefined) {
    sanitized.name = sanitized.name.trim()
    if (!sanitized.name || sanitized.name.length > 30) return { error: '분류 이름은 1~30자로 입력해주세요.' }
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('finance_categories')
    .update(sanitized)
    .eq('id', categoryId)
    .select('account_id')
    .single()
  if (error) {
    if (error.code === '23505') return { error: '같은 이름의 분류가 이미 있습니다.' }
    return { error: '분류 수정에 실패했습니다.' }
  }
  revalidateFinance(data.account_id)
  return {}
}

// ============================================================================
// 거래
// ============================================================================

function normalizeTransactionInput(input: TransactionInput) {
  const sanitized = sanitizeObject({
    description: input.description,
    memo: input.memo ?? '',
  })
  return {
    account_id: input.account_id,
    category_id: input.category_id,
    occurred_at: input.occurred_at,
    description: sanitized.description.trim(),
    amount: input.amount,
    memo: sanitized.memo.trim() || null,
    club_id: input.club_id || null,
    tournament_id: input.tournament_id || null,
  }
}

/** 분류가 해당 계정 소속인지 검증 (다른 통장 분류 섞임 방지) */
async function assertCategoryBelongs(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  categoryId: string
): Promise<string | null> {
  const { data } = await admin
    .from('finance_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('account_id', accountId)
    .maybeSingle()
  return data ? null : '선택한 분류가 이 통장의 분류가 아닙니다.'
}

export async function createTransaction(input: TransactionInput): Promise<{ error?: string; id?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const row = normalizeTransactionInput(input)
  const errors = validateTransactionInput(row)
  if (hasValidationErrors(errors)) return { error: Object.values(errors).find(Boolean) }

  const admin = createAdminClient()
  const belongsError = await assertCategoryBelongs(admin, row.account_id, row.category_id)
  if (belongsError) return { error: belongsError }

  const { data, error } = await admin
    .from('finance_transactions')
    .insert({ ...row, source: 'MANUAL', created_by: auth.userId })
    .select('id')
    .single()
  if (error) return { error: '거래 저장에 실패했습니다.' }
  revalidateFinance(row.account_id)
  return { id: data.id }
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const row = normalizeTransactionInput(input)
  const errors = validateTransactionInput(row)
  if (hasValidationErrors(errors)) return { error: Object.values(errors).find(Boolean) }

  const admin = createAdminClient()
  const belongsError = await assertCategoryBelongs(admin, row.account_id, row.category_id)
  if (belongsError) return { error: belongsError }

  // account_id 변경은 허용하지 않음 (다른 통장으로 이동은 삭제 후 재입력)
  const { account_id: _ignored, ...patch } = row
  void _ignored
  const { error } = await admin
    .from('finance_transactions')
    .update(patch)
    .eq('id', transactionId)
    .eq('account_id', row.account_id)
  if (error) return { error: '거래 수정에 실패했습니다.' }
  revalidateFinance(row.account_id)
  return {}
}

export async function deleteTransaction(transactionId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('finance_transactions')
    .delete()
    .eq('id', transactionId)
    .select('account_id')
    .maybeSingle()
  if (error) return { error: '거래 삭제에 실패했습니다.' }
  revalidateFinance(data?.account_id)
  return {}
}

// ============================================================================
// 원장 조회
// ============================================================================

/**
 * 월별 원장 — 이월잔액·당월 거래·분류 소계를 한 번에
 * 이월잔액 = 기초잔액 + Σ(월 시작 이전 거래) → 저장값 없이 항상 계산
 */
export async function getMonthLedger(
  accountId: string,
  year: number,
  month: number
): Promise<{ data?: MonthLedger; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()
  const { start, end } = getKSTMonthRange(year, month)

  // 계정 / 분류 / (월말까지의) 전체 거래 — 병렬 3쿼리
  const [accountRes, categoriesRes, txRes] = await Promise.all([
    admin.from('finance_accounts').select('*').eq('id', accountId).single(),
    admin
      .from('finance_categories')
      .select('*')
      .eq('account_id', accountId)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true }),
    admin
      .from('finance_transactions')
      .select(TX_SELECT)
      .eq('account_id', accountId)
      .lt('occurred_at', end)
      .order('occurred_at', { ascending: true })
      .order('created_at', { ascending: true }),
  ])
  if (accountRes.error || !accountRes.data) return { error: '통장을 찾을 수 없습니다.' }

  const account = accountRes.data as FinanceAccount
  const categories = (categoriesRes.data ?? []) as FinanceCategory[]
  const all = (txRes.data ?? []) as unknown as FinanceTransaction[]

  const before = all.filter((t) => t.occurred_at < start)
  const inMonth = all.filter((t) => t.occurred_at >= start)

  const beforeSum = sumByKind(before)
  const openingBalance = account.opening_balance + beforeSum.income - beforeSum.expense
  const { income, expense } = sumByKind(inMonth)

  return {
    data: {
      account,
      year,
      month,
      openingBalance,
      totalIncome: income,
      totalExpense: expense,
      net: income - expense,
      closingBalance: openingBalance + income - expense,
      subtotals: subtotalByCategory(inMonth, categories),
      rows: computeRunningBalances(openingBalance, inMonth),
      categories: categories.filter((c) => c.is_active),
    },
  }
}

/** 연간 요약 — 모든 활성 계정의 월별 수입/지출/잔액 + 분류 합계 */
export async function getAnnualSummary(year: number): Promise<AccountAnnualSummary[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []

  const admin = createAdminClient()
  const { start, end } = getKSTYearRange(year)

  const [accountsRes, categoriesRes, txRes] = await Promise.all([
    admin.from('finance_accounts').select('*').eq('is_active', true).order('sort_order'),
    admin.from('finance_categories').select('*').order('kind').order('sort_order'),
    admin
      .from('finance_transactions')
      .select('account_id, category_id, occurred_at, amount, category:finance_categories!inner(name, kind)')
      .lt('occurred_at', end)
      .order('occurred_at', { ascending: true }),
  ])

  const accounts = (accountsRes.data ?? []) as FinanceAccount[]
  const categories = (categoriesRes.data ?? []) as FinanceCategory[]
  const all = (txRes.data ?? []) as unknown as Array<
    Pick<FinanceTransaction, 'account_id' | 'category_id' | 'occurred_at' | 'amount' | 'category'>
  >

  return accounts.map((account) => {
    const mine = all.filter((t) => t.account_id === account.id)
    const before = mine.filter((t) => t.occurred_at < start)
    const inYear = mine.filter((t) => t.occurred_at >= start)
    const b = sumByKind(before)
    const openingBalance = account.opening_balance + b.income - b.expense
    const { income, expense } = sumByKind(inYear)
    return {
      account,
      openingBalance,
      months: buildMonthlyTotals(openingBalance, inYear),
      totalIncome: income,
      totalExpense: expense,
      subtotals: subtotalByCategory(
        inYear,
        categories.filter((c) => c.account_id === account.id)
      ),
    }
  })
}

// ============================================================================
// 클럽 납부 매트릭스
// ============================================================================

export type ClubPaymentKind = 'COURT_FEE' | 'DEV_FUND' | 'ANNUAL_FEE'

/** 매트릭스 집계에 사용할 (계정 유형, 분류명) */
const CLUB_PAYMENT_SOURCE: Record<ClubPaymentKind, { accountType: FinanceAccount['account_type']; categoryName: string }> = {
  COURT_FEE: { accountType: 'CONSIGNMENT', categoryName: '동호회코트비' },
  DEV_FUND: { accountType: 'ASSOCIATION', categoryName: '발전기금' },
  ANNUAL_FEE: { accountType: 'ASSOCIATION', categoryName: '협회비' },
}

/** 클럽 × 월 납부 매트릭스 — club_id가 연결된 거래를 KST 월로 집계 */
export async function getClubPaymentMatrix(year: number, kind: ClubPaymentKind): Promise<ClubPaymentRow[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []

  const admin = createAdminClient()
  const { start, end } = getKSTYearRange(year)
  const source = CLUB_PAYMENT_SOURCE[kind]

  const isAnnualFee = kind === 'ANNUAL_FEE'
  const [clubsRes, txRes, feeRes] = await Promise.all([
    admin.from('clubs').select('id, name, court_slot').eq('is_active', true).order('name'),
    admin
      .from('finance_transactions')
      .select('club_id, occurred_at, amount, category:finance_categories!inner(name, kind, account:finance_accounts!inner(account_type))')
      .not('club_id', 'is', null)
      .gte('occurred_at', start)
      .lt('occurred_at', end),
    // 협회비 탭: 클럽 관리 스위치(club_fee_payments) 납부 여부를 함께 표시
    isAnnualFee
      ? admin.from('club_fee_payments').select('club_id, paid_at').eq('year', year)
      : Promise.resolve({ data: [] as Array<{ club_id: string; paid_at: string }> }),
  ])
  const feePaidMap = new Map((feeRes.data ?? []).map((f) => [f.club_id, f.paid_at]))

  type TxRow = {
    club_id: string
    occurred_at: string
    amount: number
    category: { name: string; kind: CategoryKind; account: { account_type: FinanceAccount['account_type'] } }
  }
  const txs = ((txRes.data ?? []) as unknown as TxRow[]).filter(
    (t) => t.category.name === source.categoryName && t.category.account.account_type === source.accountType
  )

  const byClub = new Map<string, number[]>()
  for (const t of txs) {
    const months = byClub.get(t.club_id) ?? new Array<number>(12).fill(0)
    months[toKSTParts(t.occurred_at).month - 1] += t.amount
    byClub.set(t.club_id, months)
  }

  // 코트비·발전기금: 코트 시간대가 있는 클럽 + 거래가 있는 클럽 / 협회비: 전체 활성 클럽
  const clubs = (clubsRes.data ?? []) as Array<{ id: string; name: string; court_slot: string | null }>
  return clubs
    .filter((c) => isAnnualFee || c.court_slot || byClub.has(c.id))
    .map((c) => {
      const months = byClub.get(c.id) ?? new Array<number>(12).fill(0)
      const row: ClubPaymentRow = { club_id: c.id, club_name: c.name, court_slot: c.court_slot, months, total: months.reduce((a, b) => a + b, 0) }
      if (isAnnualFee) {
        row.fee_paid = feePaidMap.has(c.id)
        row.fee_paid_at = feePaidMap.get(c.id) ?? null
      }
      return row
    })
}

/** 매트릭스 항목의 (계정, 분류) 조회 */
async function resolveClubPaymentTarget(
  admin: ReturnType<typeof createAdminClient>,
  kind: ClubPaymentKind
): Promise<{ account_id: string; category_id: string } | null> {
  const source = CLUB_PAYMENT_SOURCE[kind]
  const { data } = await admin
    .from('finance_categories')
    .select('id, account_id, account:finance_accounts!inner(account_type)')
    .eq('name', source.categoryName)
    .eq('kind', 'INCOME')
    .eq('account.account_type', source.accountType)
    .maybeSingle()
  return data ? { account_id: data.account_id, category_id: data.id } : null
}

/**
 * 클럽 납부 셀 상세 — 해당 클럽의 항목별 거래 (month=null 이면 연간)
 */
export async function getClubPaymentDetail(
  clubId: string,
  kind: ClubPaymentKind,
  year: number,
  month: number | null
): Promise<{ data?: ClubPaymentDetail; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()
  const target = await resolveClubPaymentTarget(admin, kind)
  if (!target) return { error: '해당 항목의 분류(계정)가 설정에 없습니다.' }

  const range = month ? getKSTMonthRange(year, month) : getKSTYearRange(year)
  const [clubRes, txRes, lastRes] = await Promise.all([
    admin.from('clubs').select('id, name').eq('id', clubId).single(),
    admin
      .from('finance_transactions')
      .select('id, occurred_at, description, amount, memo, source')
      .eq('club_id', clubId)
      .eq('category_id', target.category_id)
      .gte('occurred_at', range.start)
      .lt('occurred_at', range.end)
      .order('occurred_at', { ascending: true }),
    admin
      .from('finance_transactions')
      .select('amount')
      .eq('club_id', clubId)
      .eq('category_id', target.category_id)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (clubRes.error || !clubRes.data) return { error: '클럽을 찾을 수 없습니다.' }

  return {
    data: {
      club: clubRes.data,
      account_id: target.account_id,
      category_id: target.category_id,
      suggestedAmount: lastRes.data?.amount ?? null,
      transactions: (txRes.data ?? []) as ClubPaymentDetail['transactions'],
    },
  }
}

const CLUB_PAYMENT_LABEL: Record<ClubPaymentKind, string> = { COURT_FEE: '코트비', DEV_FUND: '발전기금', ANNUAL_FEE: '협회비' }

/**
 * 클럽 납부 수동 입력 — 원장 거래로 저장 (계정·분류는 항목에서 자동 결정)
 * - 협회비(ANNUAL_FEE)는 연 1회: import_key club_fee:{club}:{year} 로 1건 유지(upsert) + club_fee_payments 납부 처리
 */
export async function addClubPayment(input: {
  clubId: string
  kind: ClubPaymentKind
  occurredAt: string
  amount: number
  memo?: string | null
}): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const admin = createAdminClient()
  const target = await resolveClubPaymentTarget(admin, input.kind)
  if (!target) return { error: '해당 항목의 분류(계정)가 설정에 없습니다.' }

  const { data: club } = await admin.from('clubs').select('name').eq('id', input.clubId).single()
  if (!club) return { error: '클럽을 찾을 수 없습니다.' }

  const { year, month } = toKSTParts(input.occurredAt)
  const isAnnual = input.kind === 'ANNUAL_FEE'
  const description = isAnnual
    ? `${club.name} ${year}년 협회비`
    : `${club.name} ${month}월 ${CLUB_PAYMENT_LABEL[input.kind]}`
  const row = {
    account_id: target.account_id,
    category_id: target.category_id,
    occurred_at: input.occurredAt,
    description,
    amount: input.amount,
    memo: input.memo ? sanitizeObject({ m: input.memo }).m.trim() || null : null,
    club_id: input.clubId,
  }
  const errors = validateTransactionInput(row)
  if (hasValidationErrors(errors)) return { error: Object.values(errors).find(Boolean) }

  if (isAnnual) {
    const importKey = `club_fee:${input.clubId}:${year}`
    const [txRes, feeRes] = await Promise.all([
      admin
        .from('finance_transactions')
        .upsert({ ...row, source: 'CLUB_FEE', import_key: importKey, created_by: auth.userId }, { onConflict: 'import_key' }),
      admin
        .from('club_fee_payments')
        .upsert({ club_id: input.clubId, year, paid_at: input.occurredAt, recorded_by: auth.userId }, { onConflict: 'club_id,year' }),
    ])
    if (txRes.error || feeRes.error) return { error: '협회비 저장에 실패했습니다.' }
  } else {
    const { error } = await admin
      .from('finance_transactions')
      .insert({ ...row, source: 'MANUAL', created_by: auth.userId })
    if (error) return { error: '납부 저장에 실패했습니다.' }
  }

  revalidateFinance(target.account_id)
  revalidatePath('/admin/clubs')
  return {}
}

/**
 * 클럽 납부 거래 삭제 — 협회비(CLUB_FEE) 거래를 지우면 club_fee_payments 납부도 해제
 */
export async function deleteClubPayment(transactionId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('finance_transactions')
    .delete()
    .eq('id', transactionId)
    .select('account_id, club_id, import_key, occurred_at, source')
    .maybeSingle()
  if (error) return { error: '삭제에 실패했습니다.' }
  if (data?.source === 'CLUB_FEE' && data.club_id) {
    const { year } = toKSTParts(data.occurred_at)
    await admin.from('club_fee_payments').delete().eq('club_id', data.club_id).eq('year', year)
    revalidatePath('/admin/clubs')
  }
  revalidateFinance(data?.account_id)
  return {}
}

// ============================================================================
// 예산 (운영계획)
// ============================================================================

export async function getBudgetReport(year: number): Promise<BudgetReportRow[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []

  const admin = createAdminClient()
  const { start, end } = getKSTYearRange(year)
  const [budgetsRes, txRes] = await Promise.all([
    admin.from('finance_budgets').select('*').eq('year', year).order('sort_order').order('created_at'),
    admin
      .from('finance_transactions')
      .select('category_id, amount')
      .gte('occurred_at', start)
      .lt('occurred_at', end),
  ])
  const budgets = (budgetsRes.data ?? []) as FinanceBudget[]
  const sumByCategory = new Map<string, number>()
  for (const t of (txRes.data ?? []) as Array<{ category_id: string; amount: number }>) {
    sumByCategory.set(t.category_id, (sumByCategory.get(t.category_id) ?? 0) + t.amount)
  }
  return budgets.map((b) => {
    const actual = b.category_ids.reduce((acc, id) => acc + (sumByCategory.get(id) ?? 0), 0)
    return { ...b, actual_amount: actual, achievement: achievementRate(b.planned_amount, actual) }
  })
}

export async function upsertBudget(input: {
  id?: string
  year: number
  account_id: string
  label: string
  kind: CategoryKind
  category_ids: string[]
  planned_amount: number
  memo?: string | null
  sort_order?: number
}): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const sanitized = sanitizeObject({ label: input.label, memo: input.memo ?? '' })
  const label = sanitized.label.trim()
  if (!label || label.length > 50) return { error: '항목 이름은 1~50자로 입력해주세요.' }
  if (!Number.isInteger(input.planned_amount) || input.planned_amount < 0) {
    return { error: '계획 금액은 0 이상의 정수(원)여야 합니다.' }
  }

  const admin = createAdminClient()
  const row = {
    year: input.year,
    account_id: input.account_id,
    label,
    kind: input.kind,
    category_ids: input.category_ids,
    planned_amount: input.planned_amount,
    memo: sanitized.memo.trim() || null,
    sort_order: input.sort_order ?? 0,
  }
  const { error } = input.id
    ? await admin.from('finance_budgets').update(row).eq('id', input.id)
    : await admin.from('finance_budgets').insert(row)
  if (error) {
    if (error.code === '23505') return { error: '같은 이름의 예산 항목이 이미 있습니다.' }
    return { error: '예산 저장에 실패했습니다.' }
  }
  revalidateFinance()
  return {}
}

export async function deleteBudget(budgetId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const admin = createAdminClient()
  const { error } = await admin.from('finance_budgets').delete().eq('id', budgetId)
  if (error) return { error: '예산 삭제에 실패했습니다.' }
  revalidateFinance()
  return {}
}

// ============================================================================
// 클럽 별칭 / 클럽 목록
// ============================================================================

export interface ClubOption {
  id: string
  name: string
  court_slot: string | null
}

export async function getClubsForFinance(): Promise<ClubOption[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const admin = createAdminClient()
  const { data } = await admin.from('clubs').select('id, name, court_slot').eq('is_active', true).order('name')
  return (data ?? []) as ClubOption[]
}

export async function getClubAliases(): Promise<Array<{ alias: string; club_id: string; club_name: string }>> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const admin = createAdminClient()
  const { data } = await admin.from('finance_club_aliases').select('alias, club_id, club:clubs!inner(name)').order('alias')
  return ((data ?? []) as unknown as Array<{ alias: string; club_id: string; club: { name: string } }>).map((r) => ({
    alias: r.alias,
    club_id: r.club_id,
    club_name: r.club.name,
  }))
}

export async function upsertClubAlias(alias: string, clubId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const trimmed = sanitizeObject({ alias }).alias.trim()
  if (!trimmed || trimmed.length > 30) return { error: '별칭은 1~30자로 입력해주세요.' }
  const admin = createAdminClient()
  const { error } = await admin.from('finance_club_aliases').upsert({ alias: trimmed, club_id: clubId })
  if (error) return { error: '별칭 저장에 실패했습니다.' }
  revalidateFinance()
  return {}
}

export async function deleteClubAlias(alias: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const admin = createAdminClient()
  const { error } = await admin.from('finance_club_aliases').delete().eq('alias', alias)
  if (error) return { error: '별칭 삭제에 실패했습니다.' }
  revalidateFinance()
  return {}
}

// ============================================================================
// 가져오기 확정
// ============================================================================

export interface ImportTransactionRow {
  account_id: string
  category_id: string
  occurred_at: string
  description: string
  amount: number
  memo: string | null
  club_id: string | null
  /** 중복 방지 키 — 같은 키는 건너뜀 */
  import_key: string
}

const IMPORT_CHUNK = 200

/** 파싱·매핑이 끝난 거래를 일괄 insert. import_key 중복은 건너뜀 */
export async function commitImport(rows: ImportTransactionRow[]): Promise<{ error?: string; inserted?: number; skipped?: number }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  if (rows.length === 0) return { error: '가져올 거래가 없습니다.' }

  // 서버 사이드 재검증
  for (const r of rows) {
    const errors = validateTransactionInput(r)
    if (hasValidationErrors(errors)) {
      return { error: `${r.description || '(적요 없음)'}: ${Object.values(errors).find(Boolean)}` }
    }
  }

  const admin = createAdminClient()
  const keys = rows.map((r) => r.import_key)
  const { data: existing } = await admin.from('finance_transactions').select('import_key').in('import_key', keys)
  const existingKeys = new Set((existing ?? []).map((e) => e.import_key))
  const fresh = rows.filter((r) => !existingKeys.has(r.import_key))

  for (let i = 0; i < fresh.length; i += IMPORT_CHUNK) {
    const chunk = fresh.slice(i, i + IMPORT_CHUNK).map((r) => ({
      ...r,
      description: sanitizeObject({ d: r.description }).d.trim(),
      memo: r.memo ? sanitizeObject({ m: r.memo }).m.trim() || null : null,
      source: 'IMPORT' as const,
      created_by: auth.userId,
    }))
    const { error } = await admin.from('finance_transactions').insert(chunk)
    if (error) return { error: `가져오기 중 오류가 발생했습니다. (${i + 1}번째 묶음부터 실패)`, inserted: i, skipped: rows.length - fresh.length }
  }

  revalidateFinance()
  return { inserted: fresh.length, skipped: rows.length - fresh.length }
}
