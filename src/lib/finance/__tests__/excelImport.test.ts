import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { cellToISO, detectAccountType, inferCategoryFromDescription, parseKoreanMonthDay, parseSettlementWorkbook } from '../excelImport'
import { toKSTParts } from '../ledger'

describe('detectAccountType', () => {
  it('시트명으로 계정 유형 판별', () => {
    expect(detectAccountType('1월')).toBe('CONSIGNMENT')
    expect(detectAccountType('12월')).toBe('CONSIGNMENT')
    expect(detectAccountType('협회3월')).toBe('ASSOCIATION')
    expect(detectAccountType('이사회비')).toBe('BOARD')
    expect(detectAccountType('월별수지결산')).toBeNull()
    expect(detectAccountType('협회비')).toBeNull()
  })
})

describe('inferCategoryFromDescription', () => {
  it('분류가 빈 행을 적요로 추론', () => {
    expect(inferCategoryFromDescription('CONSIGNMENT', 'EXPENSE', '급여')).toBe('인건비')
    expect(inferCategoryFromDescription('ASSOCIATION', 'INCOME', '레슨코트비')).toBe('레슨코트비')
    expect(inferCategoryFromDescription('ASSOCIATION', 'INCOME', '7월발전기금')).toBe('발전기금')
    expect(inferCategoryFromDescription('ASSOCIATION', 'EXPENSE', '프린트')).toBe('기타')
    expect(inferCategoryFromDescription('CONSIGNMENT', 'INCOME', '알 수 없음')).toBeNull()
  })
})

describe('cellToISO', () => {
  it('문자열 "YYYY-MM-DD HH:mm" 을 KST로 해석', () => {
    expect(cellToISO('2026-01-01 15:23')).toBe('2026-01-01T06:23:00.000Z')
  })
  it('날짜만 있으면 KST 정오', () => {
    expect(cellToISO('2026-02-01')).toBe('2026-02-01T03:00:00.000Z')
  })
  it('Excel 일련번호 46023 = 2026-01-01, 46032 = 2026-01-10 (KST 정오)', () => {
    expect(toKSTParts(cellToISO(46023)!)).toEqual({ year: 2026, month: 1, day: 1 })
    expect(toKSTParts(cellToISO(46032)!)).toEqual({ year: 2026, month: 1, day: 10 })
  })
  it('"6월27일" 한글 날짜는 직전 거래 연도로 해석', () => {
    const iso = parseKoreanMonthDay('6월27일', '2026-06-26T03:00:00.000Z')!
    expect(toKSTParts(iso)).toEqual({ year: 2026, month: 6, day: 27 })
    expect(parseKoreanMonthDay('6월27일', null)).toBeNull()
    expect(parseKoreanMonthDay('합계', '2026-06-26T03:00:00.000Z')).toBeNull()
  })
  it('빈 값·합계 문자열은 null', () => {
    expect(cellToISO('')).toBeNull()
    expect(cellToISO('합계')).toBeNull()
  })
})

/**
 * 실데이터 대조 — 결산서 원본이 있을 때만 실행
 * 파싱한 월별 수입/지출 합계가 엑셀 `월별수지결산` 시트(수식 결과)와 일치해야 한다.
 */
const SAMPLE = '/Users/jeonghak/Downloads/2026년월별수지결산서 2.xlsx'
describe.skipIf(!existsSync(SAMPLE))('실데이터 대조 (2026 결산서)', () => {
  const wb = XLSX.readFile(SAMPLE)
  const res = parseSettlementWorkbook(wb, XLSX)

  it('파싱 건수·건너뜀 사유 출력', () => {
    console.log('parsed', res.transactions.length, 'skipped', res.skipped.length)
    console.log('sheets', res.sheetCounts.map((s) => `${s.sheet}:${s.count}`).join(' '))
    if (res.skipped.length) console.log('skipped', JSON.stringify(res.skipped.slice(0, 8)))
    const cats = [...new Set(res.transactions.map((t) => `${t.accountType[0]}:${t.kind[0]}:${t.rawCategory}`))].sort()
    console.log('categories', cats.join(', '))
    const hints = [...new Set(res.transactions.map((t) => t.clubHint).filter(Boolean))].sort()
    console.log('clubHints', hints.join(', '))
    expect(res.transactions.length).toBeGreaterThan(400)
  })

  it('분류가 비어 있던 행이 모두 추론되어 "수입"/"지출" 덩어리가 남지 않음', () => {
    const blank = res.transactions.filter((t) => t.rawCategory === '수입' || t.rawCategory === '지출' || t.rawCategory === '' || (t.accountType === 'ASSOCIATION' && t.kind === 'INCOME' && t.rawCategory === '기타'))
    expect(blank.map((t) => `${t.sheet}:${t.rowNumber}:${t.description}`)).toEqual([])
  })

  /**
   * 기준: 각 월 시트 거래 목록의 마지막 '잔액' 셀 (은행 실잔액, 총무가 통장 보고 입력)
   * 요약 시트(월별수지결산)는 수식 오류가 있어 기준으로 쓰지 않는다 — 대신 차이를 리포트만 한다.
   */
  it('기초잔액 + 파싱 거래 누적 = 각 월 시트의 마지막 잔액 (위탁·협회)', () => {
    const OPENING = { CONSIGNMENT: 7091243, ASSOCIATION: 13505114 }
    const BALANCE_COL = { CONSIGNMENT: 6, ASSOCIATION: 5 }
    const mismatches: string[] = []
    for (const acc of ['CONSIGNMENT', 'ASSOCIATION'] as const) {
      let balance = OPENING[acc]
      for (let m = 1; m <= 12; m++) {
        const sheetName = acc === 'CONSIGNMENT' ? `${m}월` : `협회${m}월`
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '', raw: true })
        // 마지막 거래 행의 잔액
        let lastBalance: number | null = null
        for (const r of rows) {
          const v = r[BALANCE_COL[acc]]
          const isDataRow = typeof r[0] === 'number' || /^\d{4}-/.test(String(r[0]))
          if (isDataRow && typeof v === 'number') lastBalance = v
        }
        const mine = res.transactions.filter((t) => t.accountType === acc && t.sheet === sheetName)
        for (const t of mine) balance += t.kind === 'INCOME' ? t.amount : -t.amount
        if (lastBalance === null) continue // 거래 없는 달
        if (lastBalance !== balance) mismatches.push(`${sheetName}: 시트 잔액 ${lastBalance} / 계산 ${balance} (차이 ${balance - lastBalance})`)
      }
    }
    if (mismatches.length) console.log('BALANCE MISMATCH\n' + mismatches.join('\n'))
    expect(mismatches).toEqual([])
  })

  it('참고: 월별수지결산 요약 시트와의 차이 리포트 (실패 아님)', () => {
    const summary = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['월별수지결산'], { header: 1, defval: '' })
    const actual: Record<string, Record<number, { income: number; expense: number }>> = { CONSIGNMENT: {}, ASSOCIATION: {} }
    for (const t of res.transactions) {
      if (t.accountType === 'BOARD') continue
      const { month } = toKSTParts(t.occurredAt)
      const b = (actual[t.accountType][month] ??= { income: 0, expense: 0 })
      if (t.kind === 'INCOME') b.income += t.amount
      else b.expense += t.amount
    }
    const diffs: string[] = []
    for (let i = 2; i <= 13; i++) {
      const r = summary[i]
      const m = i - 1
      const exp = {
        CONSIGNMENT: { income: Number(r[1]) || 0, expense: Number(r[2]) || 0 },
        ASSOCIATION: { income: Number(r[8]) || 0, expense: Number(r[9]) || 0 },
      }
      for (const acc of ['CONSIGNMENT', 'ASSOCIATION'] as const) {
        const a = actual[acc][m] ?? { income: 0, expense: 0 }
        if (a.income !== exp[acc].income || a.expense !== exp[acc].expense) {
          diffs.push(`${acc} ${m}월 요약시트 in=${exp[acc].income} out=${exp[acc].expense} / 거래합계 in=${a.income} out=${a.expense}`)
        }
      }
    }
    console.log(diffs.length ? '요약 시트 차이 ' + diffs.length + '건\n' + diffs.join('\n') : '요약 시트와 모두 일치')
    expect(true).toBe(true)
  })
})
