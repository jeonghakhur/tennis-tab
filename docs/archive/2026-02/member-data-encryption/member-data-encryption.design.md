# member-data-encryption Design Document

> **Summary**: profiles 테이블의 민감 개인정보(phone, birth_year, gender)를 AES-256-GCM으로 암호화하여 DB에 저장
>
> **Project**: tennis-tab
> **Version**: 0.1
> **Author**: AI Assistant
> **Date**: 2026-02-27
> **Status**: Draft
> **Planning Doc**: [member-data-encryption.plan.md](../../01-plan/features/member-data-encryption.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **App 레벨 AES-256-GCM**: Node.js 내장 `crypto` 모듈만 사용 (외부 의존성 없음)
2. **최소 변경**: 암호화/복호화를 `profileCrypto.ts` 래퍼로 캡슐화 → Server Action 2곳만 수정
3. **마이그레이션 호환**: `isEncrypted()`로 평문/암호문 혼재 기간 동시 처리
4. **tournament_entries.phone 제외**: 참가 신청 스냅샷은 이번 스코프 외 (별도 이슈)

### 1.2 암호화 대상 범위

| 필드 | 테이블 | 이번 스코프 |
|------|--------|------------|
| `phone` | `profiles` | ✅ 암호화 |
| `birth_year` | `profiles` | ✅ 암호화 |
| `gender` | `profiles` | ✅ 암호화 |
| `phone` | `tournament_entries` | ❌ 제외 (참가 시점 스냅샷, 별도 이슈) |
| `name` | `profiles` | ❌ 제외 (검색 필요) |

> **tournament_entries.phone 제외 이유**: 참가 신청 시점의 연락처 스냅샷으로, 관리자/대회 운영자가
> 직접 참조하는 경우가 많음. 암호화 시 복호화 경로가 복잡해지므로 별도 이슈로 분리.

---

## 2. Architecture

### 2.1 암호화 유틸 구조

```
src/lib/crypto/
├── encryption.ts        # AES-256-GCM 핵심 유틸 (encrypt / decrypt / isEncrypted)
└── profileCrypto.ts     # profiles 전용 래퍼 (encryptProfile / decryptProfile)
```

### 2.2 데이터 흐름

```
[클라이언트]
  profile 수정 폼 (phone, birth_year, gender 평문)
        ↓
[Server Action: updateProfile]
  encryptProfile({ phone, birth_year, gender })
        ↓
[Supabase DB: profiles]
  phone: "{iv}:{authTag}:{ciphertext}"  ← 암호문 저장
  birth_year: "{iv}:{authTag}:{ciphertext}"
  gender: "{iv}:{authTag}:{ciphertext}"
        ↓
[Server Action: getCurrentUser]
  decryptProfile(profile)  ← 조회 즉시 복호화
        ↓
[클라이언트: AuthProvider context]
  profile.phone = "01012345678"  ← 복호화된 평문
```

### 2.3 NLP 채팅 경로 (추가 수정 필요)

```
[chat/entryFlow/queries.ts: getUserProfile]
  profiles에서 phone, name, rating, club 조회
        ↓
  decryptProfile(data)  ← 복호화 필요
        ↓
  entryFlow에서 phone pre-fill → tournament_entries.phone에 평문 저장
```

### 2.4 마이그레이션 기간 호환

```
[DB에 평문 데이터 존재]
  isEncrypted(value) → false → 평문 그대로 반환 (decrypt skip)
  isEncrypted(value) → true  → decrypt 수행

[마이그레이션 완료 후]
  isEncrypted() 분기 제거 가능 (옵션)
```

---

## 3. 파일 설계

### 3.1 `src/lib/crypto/encryption.ts`

```typescript
// 암호문 형식: "{iv_hex}:{authTag_hex}:{ciphertext_hex}"
// IV 16바이트, authTag 16바이트 (GCM 기본값)

const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY'
const ENCRYPTED_PREFIX_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i

/**
 * 환경변수 ENCRYPTION_KEY를 로드. 미설정 시 throw (서버 기동 실패)
 */
function getKey(): Buffer

/**
 * AES-256-GCM 암호화
 * - IV는 매번 랜덤 생성 → 같은 값도 다른 암호문
 * - 빈 문자열/null/undefined → 그대로 반환 (암호화 skip)
 */
export function encrypt(plaintext: string): string

/**
 * AES-256-GCM 복호화
 * - authTag 검증 실패 시 throw (데이터 무결성 위반)
 * - 평문이 들어오면 (isEncrypted=false) 그대로 반환
 */
export function decrypt(ciphertext: string): string

/**
 * 암호문 여부 판별
 * - "{32hex}:{32hex}:{hex+}" 형식이면 true
 * - 마이그레이션 기간 평문/암호문 혼재 처리용
 */
export function isEncrypted(value: string): boolean
```

### 3.2 `src/lib/crypto/profileCrypto.ts`

```typescript
// profiles 테이블 암호화 대상 필드 목록
const ENCRYPTED_FIELDS = ['phone', 'birth_year', 'gender'] as const
type EncryptedField = typeof ENCRYPTED_FIELDS[number]

/**
 * 프로필 데이터의 민감 필드 암호화
 * - null/undefined/빈 문자열은 그대로 통과
 * - 이미 암호화된 값은 재암호화 skip (isEncrypted 체크)
 */
export function encryptProfile<T extends Partial<Record<EncryptedField, string | null | undefined>>>(
  data: T
): T

/**
 * 프로필 데이터의 민감 필드 복호화
 * - isEncrypted()=false면 평문 그대로 (마이그레이션 호환)
 * - null/undefined는 그대로 통과
 */
export function decryptProfile<T extends Partial<Record<EncryptedField, string | null | undefined>>>(
  data: T
): T
```

### 3.3 `src/lib/auth/actions.ts` 수정

```typescript
// 수정 1: updateProfile — 저장 전 암호화
import { encryptProfile } from '@/lib/crypto/profileCrypto'

export async function updateProfile(data: { ... }) {
  // 기존 코드 유지...
  const encrypted = encryptProfile({
    phone: data.phone,
    birth_year: data.birth_year,
    gender: data.gender,
  })

  const { error } = await supabase
    .from('profiles')
    .update({
      ...data,        // name, start_year, rating 등 평문 필드
      ...encrypted,   // phone, birth_year, gender 암호화된 값으로 덮어쓰기
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
  // ...
}

// 수정 2: getCurrentUser — 조회 후 복호화
import { decryptProfile } from '@/lib/crypto/profileCrypto'

export async function getCurrentUser() {
  // 기존 조회 코드...
  if (!profile) return null
  return decryptProfile(profile)  // 복호화된 profile 반환
}
```

### 3.4 `src/lib/chat/entryFlow/queries.ts` 수정

```typescript
// getUserProfile: profiles.phone 복호화 필요
import { decryptProfile } from '@/lib/crypto/profileCrypto'

export async function getUserProfile(userId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('name, phone, rating, club')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return decryptProfile(data)  // phone 복호화
}
```

### 3.5 마이그레이션 스크립트: `scripts/migrate-encrypt-profiles.ts`

```typescript
/**
 * 기존 평문 데이터를 암호화로 일괄 변환
 *
 * 실행: npx tsx scripts/migrate-encrypt-profiles.ts
 *
 * 동작:
 * 1. profiles 전체 조회 (pagination: 100건씩)
 * 2. isEncrypted()=false인 필드만 암호화
 * 3. 배치 업데이트 (10건씩 병렬)
 * 4. 완료 통계 출력
 *
 * 안전장치:
 * - DRY_RUN=true 환경변수로 실제 DB 수정 없이 미리 확인 가능
 * - 에러 발생 시 해당 row만 skip (전체 중단 없음)
 * - 처리 결과 로그 파일 생성 (migrate-encrypt-{timestamp}.log)
 */

interface MigrationStats {
  total: number
  encrypted: number   // 이번에 암호화한 행
  skipped: number     // 이미 암호화된 행
  errors: number      // 실패한 행
}
```

---

## 4. 환경 설정

### 4.1 환경변수

```bash
# .env.local
ENCRYPTION_KEY=<openssl rand -hex 32으로 생성한 64자 hex>
```

**키 생성 명령:**
```bash
openssl rand -hex 32
```

### 4.2 서버 기동 실패 처리

`getKey()` 함수는 `ENCRYPTION_KEY` 미설정 시 즉시 throw:

```typescript
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error('[crypto] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.')
  }
  if (hex.length !== 64) {
    throw new Error('[crypto] ENCRYPTION_KEY는 32바이트 hex (64자)여야 합니다.')
  }
  return Buffer.from(hex, 'hex')
}
```

Next.js Server Action 호출 시 `getKey()`가 실행되므로, 환경변수 없이는 모든 암호화/복호화가 실패.

---

## 5. 에러 처리

| 시나리오 | 동작 |
|---------|------|
| `ENCRYPTION_KEY` 미설정 | throw - 서버 기동 불가 |
| `ENCRYPTION_KEY` 형식 오류 (64자 아님) | throw - 서버 기동 불가 |
| authTag 검증 실패 (데이터 변조) | decrypt() throw → Server Action에서 에러 반환 |
| 복호화 오류 (DB 데이터 손상) | try-catch로 `null` 반환 + 로그 (서비스 중단 방지) |
| `isEncrypted()` 판별 불명확한 값 | 평문으로 간주 (보수적 처리) |

---

## 6. 구현 순서

```
Phase 1: crypto 유틸 구현 + 테스트
  1. [ ] src/lib/crypto/encryption.ts 구현
  2. [ ] src/lib/crypto/profileCrypto.ts 구현
  3. [ ] encrypt → decrypt 왕복 단위 테스트
  4. [ ] isEncrypted() 경계값 테스트
  5. [ ] .env.local에 ENCRYPTION_KEY 추가

Phase 2: Server Action 적용
  6. [ ] updateProfile() — encryptProfile 적용
  7. [ ] getCurrentUser() — decryptProfile 적용
  8. [ ] getUserProfile() (chat) — decryptProfile 적용
  9. [ ] DEV 환경에서 프로필 저장/조회 동작 검증

Phase 3: 마이그레이션 스크립트
  10. [ ] scripts/migrate-encrypt-profiles.ts 작성
  11. [ ] DRY_RUN=true로 대상 행 수 확인
  12. [ ] 로컬 DB에서 마이그레이션 테스트
  13. [ ] 마이그레이션 후 프로필 수정/조회 정상 동작 확인
```

---

## 7. 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/lib/crypto/encryption.ts` | **신규** | AES-256-GCM 암호화 유틸 |
| `src/lib/crypto/profileCrypto.ts` | **신규** | profiles 전용 암/복호화 래퍼 |
| `src/lib/auth/actions.ts` | **수정** | `updateProfile` encrypt + `getCurrentUser` decrypt |
| `src/lib/chat/entryFlow/queries.ts` | **수정** | `getUserProfile` decrypt |
| `scripts/migrate-encrypt-profiles.ts` | **신규** | 기존 평문 데이터 일괄 암호화 |
| `.env.local` | **수정** | `ENCRYPTION_KEY` 추가 |

---

## 8. 보안 고려사항

- **키 분실 시 복구 불가** → Vercel Dashboard + 별도 안전 위치에 이중 보관 필수
- **재암호화 skip**: `encryptProfile` 호출 전 `isEncrypted()` 체크 → 이미 암호화된 값 재처리 방지
- **같은 평문 → 다른 암호문**: IV 랜덤 생성으로 패턴 분석 불가
- **authTag 무결성 검증**: GCM 모드로 데이터 변조 감지
- **tournament_entries.phone**: 이번 스코프 외 → 추후 별도 검토

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-27 | Initial draft | AI Assistant |
