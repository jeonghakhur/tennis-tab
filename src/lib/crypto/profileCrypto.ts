import { encrypt, decrypt } from './encryption'

// profiles 테이블에서 암호화할 필드 목록
// gender는 'M'/'F' 2값뿐이라 암호화 실익이 없고 DB CHECK 제약과 충돌하므로 제외
const ENCRYPTED_FIELDS = ['phone', 'birth_year'] as const
type EncryptedField = (typeof ENCRYPTED_FIELDS)[number]

type ProfilePartial = Partial<Record<EncryptedField, string | null | undefined>>

/**
 * 프로필 민감 필드 암호화
 * - null/undefined/빈 문자열 → 그대로 통과
 * - 이미 암호화된 값 → encrypt() 내부에서 재암호화 방지
 */
export function encryptProfile<T extends ProfilePartial>(data: T): T {
  const result = { ...data }

  for (const field of ENCRYPTED_FIELDS) {
    const value = data[field]
    if (typeof value === 'string' && value) {
      ;(result as Record<string, unknown>)[field] = encrypt(value)
    }
  }

  return result
}

/**
 * 프로필 민감 필드 복호화
 * - isEncrypted()=false이면 평문 그대로 반환 (마이그레이션 기간 호환)
 * - null/undefined/빈 문자열 → 그대로 통과
 */
export function decryptProfile<T extends ProfilePartial>(data: T): T {
  const result = { ...data }

  for (const field of ENCRYPTED_FIELDS) {
    const value = data[field]
    if (typeof value === 'string' && value) {
      // decrypt()가 null 반환 시(손상 데이터) → null로 저장 (서비스 중단 방지)
      ;(result as Record<string, unknown>)[field] = decrypt(value)
    }
  }

  return result
}
