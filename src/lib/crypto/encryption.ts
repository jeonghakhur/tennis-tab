import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// 암호문 형식: "{iv_hex}:{authTag_hex}:{ciphertext_hex}"
// IV 16바이트 = 32 hex chars, authTag 16바이트 = 32 hex chars
const CIPHER_ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const AUTH_TAG_BYTES = 16
// "32hex:32hex:최소1hex" 패턴
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i

/**
 * 환경변수 ENCRYPTION_KEY 로드 (32바이트 hex = 64자)
 * 미설정 또는 형식 오류 시 throw — 서버 기동 자체를 차단
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      '[crypto] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.',
    )
  }
  if (hex.length !== 64) {
    throw new Error(
      `[crypto] ENCRYPTION_KEY는 32바이트 hex(64자)여야 합니다. 현재: ${hex.length}자`,
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * AES-256-GCM 암호화
 * - IV를 매번 랜덤 생성 → 같은 평문도 매번 다른 암호문
 * - null/undefined/빈 문자열 → 원본 그대로 반환 (암호화 skip)
 * - 이미 암호화된 값(isEncrypted=true) → 재암호화 방지를 위해 원본 반환
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext

  // 이미 암호화된 값이면 재암호화 방지
  if (isEncrypted(plaintext)) return plaintext

  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * AES-256-GCM 복호화
 * - isEncrypted()=false이면 평문으로 간주하고 그대로 반환 (마이그레이션 기간 호환)
 * - null/undefined/빈 문자열 → 원본 그대로 반환
 * - 복호화 실패(authTag 불일치, 데이터 손상) 시 null 반환 + 에러 로그
 *   → 서비스 중단 방지 (마이그레이션 기간 중 손상 데이터 대응)
 */
export function decrypt(ciphertext: string): string | null {
  if (!ciphertext) return ciphertext

  // 암호문 형식이 아니면 평문으로 간주 (마이그레이션 기간 호환)
  if (!isEncrypted(ciphertext)) return ciphertext

  try {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
    const key = getKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const encryptedData = Buffer.from(encryptedHex, 'hex')

    const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err) {
    // authTag 불일치 또는 데이터 손상 — null 반환으로 서비스 중단 방지
    console.error('[crypto] decrypt 실패 (데이터 손상 또는 키 불일치):', err)
    return null
  }
}

/**
 * 암호문 여부 판별
 * "{32hex}:{32hex}:{hex+}" 형식이면 true
 * 마이그레이션 기간 평문/암호문 혼재 처리에 사용
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  return ENCRYPTED_PATTERN.test(value)
}
