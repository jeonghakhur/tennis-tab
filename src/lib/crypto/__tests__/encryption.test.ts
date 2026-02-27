import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt, isEncrypted } from '../encryption'

const VALID_KEY = 'a'.repeat(64) // 64자 hex

describe('isEncrypted', () => {
  it('{32hex}:{32hex}:{hex+} 형식이면 true', () => {
    const iv = 'a'.repeat(32)
    const tag = 'b'.repeat(32)
    const ct = 'c'.repeat(64)
    expect(isEncrypted(`${iv}:${tag}:${ct}`)).toBe(true)
  })

  it('평문 문자열이면 false', () => {
    expect(isEncrypted('01012345678')).toBe(false)
    expect(isEncrypted('1990')).toBe(false)
    expect(isEncrypted('M')).toBe(false)
  })

  it('빈 문자열이면 false', () => {
    expect(isEncrypted('')).toBe(false)
  })

  it('부분적으로 맞는 형식이면 false', () => {
    // iv만 있고 나머지 없음
    expect(isEncrypted('a'.repeat(32))).toBe(false)
    // iv:tag 두 파트만
    expect(isEncrypted(`${'a'.repeat(32)}:${'b'.repeat(32)}`)).toBe(false)
    // iv가 32자 미만
    expect(isEncrypted(`${'a'.repeat(31)}:${'b'.repeat(32)}:${'c'.repeat(32)}`)).toBe(false)
  })
})

describe('encrypt / decrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypt 결과는 isEncrypted()=true', () => {
    const result = encrypt('01012345678')
    expect(isEncrypted(result)).toBe(true)
  })

  it('encrypt → decrypt 왕복 검증 (phone)', () => {
    const plain = '01012345678'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('encrypt → decrypt 왕복 검증 (birth_year)', () => {
    const plain = '1990'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('encrypt → decrypt 왕복 검증 (gender)', () => {
    expect(decrypt(encrypt('M'))).toBe('M')
    expect(decrypt(encrypt('F'))).toBe('F')
  })

  it('같은 평문을 두 번 암호화하면 다른 암호문 (IV 랜덤)', () => {
    const plain = '01012345678'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('빈 문자열은 암호화 skip', () => {
    expect(encrypt('')).toBe('')
  })

  it('이미 암호화된 값은 재암호화 안 함', () => {
    const ciphertext = encrypt('01012345678')
    expect(encrypt(ciphertext)).toBe(ciphertext)
  })

  it('decrypt: 평문이 들어오면 그대로 반환 (마이그레이션 호환)', () => {
    expect(decrypt('01012345678')).toBe('01012345678')
    expect(decrypt('1990')).toBe('1990')
    expect(decrypt('M')).toBe('M')
  })

  it('decrypt: 빈 문자열은 그대로 반환', () => {
    expect(decrypt('')).toBe('')
  })

  it('decrypt: 손상된 암호문은 null 반환 (서비스 중단 방지)', () => {
    // isEncrypted()=true 형식이지만 실제로는 손상된 데이터
    const corrupted = `${'a'.repeat(32)}:${'b'.repeat(32)}:${'c'.repeat(32)}`
    expect(decrypt(corrupted)).toBeNull()
  })
})

describe('환경변수 검증', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('ENCRYPTION_KEY 미설정 시 encrypt()에서 throw', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
  })

  it('ENCRYPTION_KEY가 64자 미만이면 throw', () => {
    process.env.ENCRYPTION_KEY = 'abc'
    expect(() => encrypt('test')).toThrow('64자')
  })
})
