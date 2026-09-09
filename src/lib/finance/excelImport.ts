/**
 * 결산서 엑셀 파서 (순수 함수 — 브라우저/서버 공용, DB 의존 없음)
 *
 * 지원 시트
 * - `N월`      : 위탁통장. 헤더 [일시, 적요, 분류, 입금액, 출금액, 비고, 잔액]
 * - `협회N월`  : 협회통장. 헤더 [일시, 구분, 적요, 출금액, 입금액, 잔액, 비고] (날짜는 Excel 일련번호)
 * - `이사회비` : 이사회비. 헤더 [날자, 내용, 입금, 지출, 비고]
 *
 * 출력은 "원본 문자열 + 정규화 값"이며, 분류·클럽의 최종 매핑은 가져오기 화면에서 확정한다.
 */
import type * as XLSXType from 'xlsx'
import type { AccountType, CategoryKind } from './types'

export interface ParsedTransaction {
  accountType: AccountType
  sheet: string
  /** 시트 내 행 번호 (1-based, 사용자 안내용) */
  rowNumber: number
  /** ISO (KST 해석) */
  occurredAt: string
  description: string
  kind: CategoryKind
  amount: number
  /** 엑셀에 적힌 분류 원문 (정규화 후) */
  rawCategory: string
  /** 클럽 추정 문자열 (비고 또는 구분) */
  clubHint: string | null
  memo: string | null
  /** 중복 방지 키 */
  importKey: string
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  /** 시트별 파싱 건수 */
  sheetCounts: Array<{ sheet: string; accountType: AccountType; count: number }>
  /** 건너뛴 행 (사유 포함) */
  skipped: Array<{ sheet: string; rowNumber: number; reason: string }>
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
/** Excel 일련번호 기준일 (1899-12-30) */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** 위탁통장 분류 원문 → 시드 분류명 (오타·약칭 보정) */
export const CONSIGNMENT_CATEGORY_ALIASES: Record<string, string> = {
  '동호회': '동호회코트비',
  '동회회': '동호회코트비',
  '동호회코트비': '동호회코트비',
  '개인': '개인 코트비',
  '개인 코트비': '개인 코트비',
  '개인코트비': '개인 코트비',
}

/** 협회통장 분류 원문 → 시드 분류명 */
export const ASSOCIATION_CATEGORY_ALIASES: Record<string, string> = {
  '체육회장배': '체육회장배대회',
  '협회장배대회': '협회장기대회',
  '협회장배': '협회장기대회',
  '마포구청장기': '구청장기대회',
  '구청장기': '구청장기대회',
  '서울시장기': '서울시장기대회',
  '서울협회장배': '서울협회장배대회',
  '서울시협회장배대회': '서울협회장배대회',
}

/**
 * 분류 칸이 비어 있을 때 적요 키워드로 추론 (계정 유형별, 먼저 맞는 것 우선)
 * 엑셀에서 분류를 빠뜨린 행이 매핑 단계에서 '수입'/'지출' 덩어리로 묶이는 것을 방지
 */
const DESCRIPTION_CATEGORY_HINTS: Record<AccountType, Array<{ kind: CategoryKind; pattern: RegExp; category: string }>> = {
  CONSIGNMENT: [
    { kind: 'EXPENSE', pattern: /급여|인건비/, category: '인건비' },
    { kind: 'EXPENSE', pattern: /전기|수도|가스|요금/, category: '수도광열비' },
    { kind: 'EXPENSE', pattern: /렌탈|정수|통신|DLIVE|생수|프린트|사무/i, category: '기타운영비' },
    { kind: 'EXPENSE', pattern: /수리|환불|그물|컴프|콤프|에어컨/, category: '시설운영비' },
    { kind: 'INCOME', pattern: /toss|토스/i, category: '개인 코트비' },
    { kind: 'INCOME', pattern: /코트비|동호회/, category: '동호회코트비' },
    { kind: 'INCOME', pattern: /이자/, category: '이자' },
  ],
  ASSOCIATION: [
    { kind: 'INCOME', pattern: /레슨/, category: '레슨코트비' },
    { kind: 'INCOME', pattern: /발전기금/, category: '발전기금' },
    { kind: 'INCOME', pattern: /협회비|연회비/, category: '협회비' },
    { kind: 'INCOME', pattern: /찬조/, category: '찬조' },
    { kind: 'INCOME', pattern: /참가비/, category: '참가비' },
    { kind: 'INCOME', pattern: /이자/, category: '이자' },
    { kind: 'EXPENSE', pattern: /식비|식대|회식|점심|저녁|커피|김밥|음료/, category: '식비' },
    { kind: 'EXPENSE', pattern: /체육회비/, category: '체육회비' },
    { kind: 'EXPENSE', pattern: /./, category: '기타' },
  ],
  BOARD: [],
}

export function inferCategoryFromDescription(accountType: AccountType, kind: CategoryKind, description: string): string | null {
  for (const h of DESCRIPTION_CATEGORY_HINTS[accountType]) {
    if (h.kind === kind && h.pattern.test(description)) return h.category
  }
  return null
}

/** 시트명 → 계정 유형 */
export function detectAccountType(sheetName: string): AccountType | null {
  if (/^협회\d{1,2}월$/.test(sheetName)) return 'ASSOCIATION'
  if (/^\d{1,2}월$/.test(sheetName)) return 'CONSIGNMENT'
  if (sheetName === '이사회비') return 'BOARD'
  return null
}

/** 셀 값 → 정수 금액 (빈 값·비숫자는 0) */
function toAmount(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,\s원]/g, ''))
    return Number.isFinite(n) ? Math.round(n) : 0
  }
  return 0
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/‭|‬/g, '').trim() // 방향 제어 문자 제거
}

/**
 * 셀 값 → ISO 시각 (KST 해석)
 * - 문자열 "YYYY-MM-DD HH:mm[:ss]" 또는 "YYYY-MM-DD"
 * - 숫자: Excel 일련번호 (소수부 = 시각), 시각이 없으면 12:00 KST
 * - Date 객체
 */
export function cellToISO(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  if (typeof v === 'number' && Number.isFinite(v)) {
    const days = Math.floor(v)
    const frac = v - days
    const timeMs = frac > 0 ? Math.round(frac * MS_PER_DAY) : 12 * 60 * 60 * 1000
    return new Date(EXCEL_EPOCH_UTC + days * MS_PER_DAY + timeMs - KST_OFFSET_MS).toISOString()
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
    if (!m) return null
    const [, y, mo, d, h, mi, s] = m
    const hour = h !== undefined ? Number(h) : 12
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(mi ?? 0), Number(s ?? 0)) - KST_OFFSET_MS
    return new Date(utc).toISOString()
  }
  return null
}

/** "6월27일" 같은 한글 날짜 → 직전 거래의 연도를 붙여 KST 정오로 해석 */
export function parseKoreanMonthDay(cell: unknown, lastDate: string | null): string | null {
  if (typeof cell !== 'string' || !lastDate) return null
  const m = cell.trim().match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/)
  if (!m) return null
  const year = new Date(new Date(lastDate).getTime() + KST_OFFSET_MS).getUTCFullYear()
  return new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2]), 12) - KST_OFFSET_MS).toISOString()
}

/** 간단 해시 (import_key용, 충돌 방지 목적의 djb2) */
function hashKey(parts: string[]): string {
  const str = parts.join('|')
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function makeKey(accountType: AccountType, occurredAt: string, description: string, kind: CategoryKind, amount: number): string {
  return `xlsx:${accountType}:${hashKey([occurredAt, description, kind, String(amount)])}`
}

type Row = unknown[]

/**
 * 행의 거래 일시 결정
 * - 날짜 셀이 있으면 그 값
 * - 날짜 셀이 비어 있어도 적요·금액이 있으면 직전 거래 날짜를 상속
 *   (엑셀에서 같은 날 여러 건을 적을 때 날짜를 생략하는 경우 — 잔액 흐름에는 포함되어 있음)
 * - 합계 행(적요 없음·'합계')은 null
 */
function resolveDate(cell: unknown, lastDate: string | null, description: string, income: number, expense: number): string | null {
  const parsed = cellToISO(cell) ?? parseKoreanMonthDay(cell, lastDate)
  if (parsed) return parsed
  if (!description || description === '합계') return null
  if (income === 0 && expense === 0) return null
  return lastDate
}

/** 헤더 행 찾기: 첫 셀이 '일시' 또는 '날자'/'날짜' 로 시작하는 행 */
function findHeaderRow(rows: Row[]): number {
  return rows.findIndex((r) => /^(일\s*시|날자|날짜)/.test(toText(r[0])))
}

function parseConsignmentSheet(sheet: string, rows: Row[], result: ParseResult) {
  const header = findHeaderRow(rows)
  if (header < 0) return
  let count = 0
  let lastDate: string | null = null
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i]
    const description = toText(r[1])
    const rawCat = toText(r[2])
    const income = toAmount(r[3])
    const expense = toAmount(r[4])
    const occurredAt = resolveDate(r[0], lastDate, description, income, expense)
    if (!occurredAt) continue // 합계 행·빈 행
    lastDate = occurredAt
    if (income === 0 && expense === 0) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '금액 없음' })
      continue
    }
    if (income > 0 && expense > 0) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '입금·출금 동시 입력' })
      continue
    }
    const kind: CategoryKind = income > 0 ? 'INCOME' : 'EXPENSE'
    const amount = income > 0 ? income : expense
    const normalized = CONSIGNMENT_CATEGORY_ALIASES[rawCat] ?? rawCat
    const rawCategory = normalized || inferCategoryFromDescription('CONSIGNMENT', kind, description) || ''
    const memo = toText(r[5]) || null
    result.transactions.push({
      accountType: 'CONSIGNMENT',
      sheet,
      rowNumber: i + 1,
      occurredAt,
      description: description || '(적요 없음)',
      kind,
      amount,
      rawCategory: rawCategory || (kind === 'INCOME' ? '수입' : '지출'),
      // 위탁통장: 비고에 클럽 약칭. 동호회 코트비일 때만 클럽으로 해석
      clubHint: rawCategory === '동호회코트비' && memo ? memo : null,
      memo,
      importKey: makeKey('CONSIGNMENT', occurredAt, description, kind, amount),
    })
    count++
  }
  result.sheetCounts.push({ sheet, accountType: 'CONSIGNMENT', count })
}

function parseAssociationSheet(sheet: string, rows: Row[], result: ParseResult) {
  const header = findHeaderRow(rows)
  if (header < 0) return
  let count = 0
  let lastDate: string | null = null
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i]
    const gubun = toText(r[1])
    const jeokyo = toText(r[2])
    const expense = toAmount(r[3])
    const income = toAmount(r[4])
    const rawCat = toText(r[6])
    const occurredAt = resolveDate(r[0], lastDate, gubun || jeokyo, income, expense)
    if (!occurredAt) continue
    lastDate = occurredAt
    if (income === 0 && expense === 0) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '금액 없음' })
      continue
    }
    if (income > 0 && expense > 0) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '입금·출금 동시 입력' })
      continue
    }
    const kind: CategoryKind = income > 0 ? 'INCOME' : 'EXPENSE'
    const amount = income > 0 ? income : expense
    const description = [gubun, jeokyo].filter(Boolean).join(' ') || '(적요 없음)'
    const normalized = ASSOCIATION_CATEGORY_ALIASES[rawCat] ?? rawCat
    // 수입 행의 '기타'는 실제 분류가 아니므로(이자 등) 적요로 먼저 추론
    const needsInference = !normalized || (kind === 'INCOME' && normalized === '기타')
    const rawCategory = needsInference
      ? inferCategoryFromDescription('ASSOCIATION', kind, description) || normalized || ''
      : normalized
    result.transactions.push({
      accountType: 'ASSOCIATION',
      sheet,
      rowNumber: i + 1,
      occurredAt,
      description,
      kind,
      amount,
      rawCategory: rawCategory || (kind === 'INCOME' ? '수입' : '지출'),
      // 협회통장: 발전기금·협회비 수입은 구분 칸이 클럽명
      clubHint: kind === 'INCOME' && (rawCategory === '발전기금' || rawCategory === '협회비') && gubun ? gubun : null,
      memo: null,
      importKey: makeKey('ASSOCIATION', occurredAt, description, kind, amount),
    })
    count++
  }
  result.sheetCounts.push({ sheet, accountType: 'ASSOCIATION', count })
}

function parseBoardSheet(sheet: string, rows: Row[], result: ParseResult) {
  const header = findHeaderRow(rows)
  if (header < 0) return
  let count = 0
  let lastDate: string | null = null
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i]
    const content = toText(r[1])
    if (!content || content === '합계') continue
    if (content === '이월금') continue // 기초잔액으로 관리
    const occurredAt: string | null = cellToISO(r[0]) ?? parseKoreanMonthDay(r[0], lastDate) ?? lastDate
    if (!occurredAt) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '날짜 없음' })
      continue
    }
    lastDate = occurredAt
    const income = toAmount(r[2])
    const expense = toAmount(r[3])
    if (income === 0 && expense === 0) {
      result.skipped.push({ sheet, rowNumber: i + 1, reason: '금액 없음' })
      continue
    }
    const kind: CategoryKind = income > 0 ? 'INCOME' : 'EXPENSE'
    const amount = income > 0 ? income : expense
    const memo = toText(r[4]) || null
    result.transactions.push({
      accountType: 'BOARD',
      sheet,
      rowNumber: i + 1,
      occurredAt,
      description: content,
      kind,
      amount,
      rawCategory: kind === 'INCOME' ? '이사회비' : content.includes('회식') ? '회식' : '기타',
      clubHint: null,
      memo,
      importKey: makeKey('BOARD', occurredAt, content, kind, amount),
    })
    count++
  }
  result.sheetCounts.push({ sheet, accountType: 'BOARD', count })
}

/** 워크북 전체 파싱 */
export function parseSettlementWorkbook(workbook: XLSXType.WorkBook, xlsx: typeof XLSXType): ParseResult {
  const result: ParseResult = { transactions: [], sheetCounts: [], skipped: [] }
  for (const name of workbook.SheetNames) {
    const type = detectAccountType(name)
    if (!type) continue
    const rows = xlsx.utils.sheet_to_json<Row>(workbook.Sheets[name], { header: 1, defval: '', raw: true })
    if (type === 'CONSIGNMENT') parseConsignmentSheet(name, rows, result)
    else if (type === 'ASSOCIATION') parseAssociationSheet(name, rows, result)
    else parseBoardSheet(name, rows, result)
  }
  // 시간순 정렬
  result.transactions.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  return result
}
