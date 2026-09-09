import { describe, it, expect } from 'vitest'
import { validateTransactionInput } from '@/lib/utils/validation'

const valid = {
  occurred_at: '2026-01-05T01:00:00.000Z',
  description: '한우리 코트비',
  amount: 350000,
  category_id: 'cat',
  memo: '한우리',
}

describe('validateTransactionInput', () => {
  it('정상 입력은 에러 없음', () => {
    expect(validateTransactionInput(valid)).toEqual({})
  })
  it('문자열 금액(콤마 포함) 허용', () => {
    expect(validateTransactionInput({ ...valid, amount: '1,328,889' })).toEqual({})
  })
  it('음수·소수·0 금액 거부', () => {
    expect(validateTransactionInput({ ...valid, amount: -1 }).amount).toBeTruthy()
    expect(validateTransactionInput({ ...valid, amount: 10.5 }).amount).toBeTruthy()
    expect(validateTransactionInput({ ...valid, amount: 0 }).amount).toBeTruthy()
  })
  it('적요 필수·100자 제한', () => {
    expect(validateTransactionInput({ ...valid, description: '' }).description).toBeTruthy()
    expect(validateTransactionInput({ ...valid, description: 'x'.repeat(101) }).description).toBeTruthy()
  })
  it('잘못된 일시·분류 누락·비고 200자 초과', () => {
    expect(validateTransactionInput({ ...valid, occurred_at: 'not-a-date' }).occurred_at).toBeTruthy()
    expect(validateTransactionInput({ ...valid, category_id: '' }).category_id).toBeTruthy()
    expect(validateTransactionInput({ ...valid, memo: 'x'.repeat(201) }).memo).toBeTruthy()
  })
})
