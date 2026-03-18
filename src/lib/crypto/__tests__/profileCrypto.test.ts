import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptProfile, decryptProfile } from '../profileCrypto'
import { isEncrypted } from '../encryption'

const VALID_KEY = 'a'.repeat(64)

describe('encryptProfile', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('phone, birth_year를 암호화한다', () => {
    const result = encryptProfile({ phone: '01012345678', birth_year: '1990' })
    expect(isEncrypted(result.phone!)).toBe(true)
    expect(isEncrypted(result.birth_year!)).toBe(true)
  })

  it('gender는 암호화 대상이 아니므로 그대로 유지된다', () => {
    const result = encryptProfile({ phone: '01012345678', birth_year: '1990', gender: 'MALE' })
    expect(result.gender).toBe('MALE') // CHECK 제약('MALE'/'FEMALE') 있는 2값 필드라 암호화 제외
  })

  it('null 필드는 그대로 유지한다', () => {
    const result = encryptProfile({ phone: null, birth_year: '1990' })
    expect(result.phone).toBeNull()
    expect(result.birth_year).toBeTruthy()
  })

  it('빈 문자열은 그대로 유지한다', () => {
    const result = encryptProfile({ phone: '', birth_year: '1990' })
    expect(result.phone).toBe('')
  })

  it('일부 필드만 있어도 정상 처리', () => {
    const result = encryptProfile({ phone: '01012345678', birth_year: undefined })
    expect(isEncrypted(result.phone!)).toBe(true)
    expect(result.birth_year).toBeUndefined()
  })
})

describe('decryptProfile', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypt → decrypt 왕복 검증', () => {
    const original = { phone: '01012345678', birth_year: '1990', gender: 'MALE' }
    const encrypted = encryptProfile(original)
    const decrypted = decryptProfile(encrypted)
    expect(decrypted).toEqual(original)
  })

  it('평문 값이 들어오면 그대로 반환 (마이그레이션 호환)', () => {
    const plain = { phone: '01012345678', birth_year: '1990', gender: 'FEMALE' }
    const result = decryptProfile(plain)
    expect(result).toEqual(plain)
  })

  it('null 필드는 그대로 유지', () => {
    const result = decryptProfile({ phone: null, birth_year: '1990' })
    expect(result.phone).toBeNull()
  })

  it('혼재 데이터 처리 (일부 암호화, 일부 평문)', () => {
    const encrypted = encryptProfile({ phone: '01012345678' })
    const mixed = { phone: encrypted.phone, birth_year: '1990', gender: 'MALE' }
    const result = decryptProfile(mixed)
    expect(result.phone).toBe('01012345678')
    expect(result.birth_year).toBe('1990')
    expect(result.gender).toBe('MALE')
  })
})
