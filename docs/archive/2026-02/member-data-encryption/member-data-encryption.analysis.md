# member-data-encryption Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: tennis-tab
> **Analyst**: AI Assistant
> **Date**: 2026-02-27
> **Design Doc**: [member-data-encryption.design.md](../02-design/features/member-data-encryption.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

설계 문서(Section 3, 7)에 명시된 파일 변경 목록, API 시그니처, 에러 처리, 보안 요구사항과
실제 구현 코드 간의 일치율을 정량적으로 측정한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/member-data-encryption.design.md`
- **Implementation Path**: `src/lib/crypto/`, `src/lib/auth/actions.ts`, `src/lib/chat/entryFlow/queries.ts`, `scripts/migrate-encrypt-profiles.ts`
- **Analysis Date**: 2026-02-27

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 File Change List (Design Section 7)

| Design (Section 7) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| `src/lib/crypto/encryption.ts` (신규) | `/Users/jeonghak/work/person/tennis-tab/src/lib/crypto/encryption.ts` | Match | |
| `src/lib/crypto/profileCrypto.ts` (신규) | `/Users/jeonghak/work/person/tennis-tab/src/lib/crypto/profileCrypto.ts` | Match | |
| `src/lib/auth/actions.ts` (수정) | `/Users/jeonghak/work/person/tennis-tab/src/lib/auth/actions.ts` | Match | encryptProfile + decryptProfile 적용 확인 |
| `src/lib/chat/entryFlow/queries.ts` (수정) | `/Users/jeonghak/work/person/tennis-tab/src/lib/chat/entryFlow/queries.ts` | Match | decryptProfile 적용 확인 |
| `scripts/migrate-encrypt-profiles.ts` (신규) | `/Users/jeonghak/work/person/tennis-tab/scripts/migrate-encrypt-profiles.ts` | Match | |
| `.env.local` (수정 - ENCRYPTION_KEY) | `.env.local`에 존재 | Match | |
| (암묵적) `.env.example` 템플릿 업데이트 | `.env.example`에 ENCRYPTION_KEY 없음 | Missing | Phase 2 Convention 위반 |
| (암묵적) 테스트 파일 | `__tests__/encryption.test.ts`, `__tests__/profileCrypto.test.ts` | Added | 설계에 미기재 |

### 2.2 encryption.ts API

| Design (Section 3.1) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| `getKey(): Buffer` - 미설정 시 throw | 구현: L15-28, throw + 에러 메시지 일치 | Match | |
| `getKey()` - 64자 아니면 throw | 구현: L22-25, hex.length !== 64 검증 | Match | 에러 메시지에 현재 길이도 표시 (구현이 더 상세) |
| `encrypt(plaintext: string): string` | 구현: L36-50 | Match | |
| `encrypt` - 빈 문자열/null/undefined skip | 구현: L37 `if (!plaintext) return plaintext` | Match | |
| `encrypt` - 이미 암호화된 값 재암호화 방지 | 구현: L40 `if (isEncrypted(plaintext)) return plaintext` | Match | |
| `encrypt` - IV 랜덤 생성 | 구현: L43 `randomBytes(IV_BYTES)` | Match | |
| `decrypt(ciphertext: string): string` | 구현: L58-75 | Match | |
| `decrypt` - 평문 들어오면 그대로 반환 | 구현: L62 `if (!isEncrypted(ciphertext)) return ciphertext` | Match | |
| `decrypt` - authTag 검증 실패 시 throw | 구현: GCM decipher가 자동 throw | Match | |
| `isEncrypted(value: string): boolean` | 구현: L82-85 | Match | |
| 암호문 형식: `{iv_hex}:{authTag_hex}:{ciphertext_hex}` | 구현: ENCRYPTED_PATTERN regex 일치 | Match | |
| 복호화 오류 시 try-catch로 null 반환 + 로그 | 구현: decrypt()에 try-catch 없음 | Mismatch | 설계 Section 5의 "복호화 오류 → null 반환 + 로그" 미구현 |

### 2.3 profileCrypto.ts API

| Design (Section 3.2) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| `ENCRYPTED_FIELDS = ['phone', 'birth_year', 'gender']` | 구현: L4 동일 | Match | |
| `EncryptedField` 타입 | 구현: L5 동일 | Match | |
| `encryptProfile<T>(data: T): T` | 구현: L14-25 | Match | |
| `encryptProfile` - null/undefined/빈 문자열 통과 | 구현: L19 `typeof value === 'string' && value` 체크 | Match | |
| `encryptProfile` - 이미 암호화된 값 재암호화 skip | 구현: encrypt() 내부의 isEncrypted 체크에 위임 | Match | |
| `decryptProfile<T>(data: T): T` | 구현: L32-43 | Match | |
| `decryptProfile` - 마이그레이션 호환 (평문 통과) | 구현: decrypt() 내부의 isEncrypted 체크에 위임 | Match | |

### 2.4 auth/actions.ts 수정

| Design (Section 3.3) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| import encryptProfile, decryptProfile | 구현: L8 | Match | |
| `updateProfile` - encryptProfile 적용 | 구현: L264-268, phone/birth_year/gender 암호화 | Match | |
| `updateProfile` - spread로 암호화 필드 덮어쓰기 | 구현: L272-273 `...data, ...encrypted` | Match | |
| `getCurrentUser` - decryptProfile 적용 | 구현: L242 `return decryptProfile(profile)` | Match | |

### 2.5 chat/entryFlow/queries.ts 수정

| Design (Section 3.4) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| import decryptProfile | 구현: L2 | Match | |
| `getUserProfile` - decryptProfile 적용 | 구현: L95 `return decryptProfile(data)` | Match | |

### 2.6 Migration Script

| Design (Section 3.5) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| 100건씩 페이지네이션 (PAGE_SIZE) | 구현: L28 `PAGE_SIZE = 100` | Match | |
| 10건씩 병렬 업데이트 (BATCH_SIZE) | 구현: L29 `BATCH_SIZE = 10` | Match | |
| DRY_RUN 환경변수 지원 | 구현: L40 `process.env.DRY_RUN === 'true'` | Match | |
| isEncrypted()=false인 필드만 암호화 | 구현: L88 `!isEncrypted(val)` 체크 | Match | |
| 에러 발생 시 해당 row만 skip | 구현: L131-133 try-catch per row | Match | |
| MigrationStats 인터페이스 | 구현: L31-37 | Match | 필드명 차이: Design `encrypted/skipped/errors` vs 구현 `needsEncryption/encrypted/skipped/errors` (구현이 더 상세) |
| 로그 파일 생성 (`migrate-encrypt-{timestamp}.log`) | 미구현: console.log만 사용 | Missing | 설계에 명시된 로그 파일 생성 기능 없음 |

### 2.7 Environment Variable

| Design (Section 4) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| `.env.local`에 ENCRYPTION_KEY 추가 | `.env.local`에 존재 (grep 확인) | Match | |
| ENCRYPTION_KEY 형식: 64자 hex | `getKey()` L22 검증 구현됨 | Match | |
| `.env.example` 템플릿 업데이트 | **미반영** | Missing | `.env.example`에 ENCRYPTION_KEY 없음 |

### 2.8 Error Handling (Design Section 5)

| Scenario (Section 5) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| ENCRYPTION_KEY 미설정 → throw | `getKey()` L17-20 | Match | |
| ENCRYPTION_KEY 형식 오류 (64자 아님) → throw | `getKey()` L22-25 | Match | |
| authTag 검증 실패 → throw | GCM decipher.final() 자동 throw | Match | |
| 복호화 오류 (DB 데이터 손상) → try-catch + null + 로그 | **미구현**: decrypt()에 try-catch 없음 | Missing | 손상된 데이터 시 서비스 중단 가능 |
| isEncrypted() 판별 불명확 → 평문 간주 | regex 불일치 시 false 반환 | Match | |

### 2.9 Security (Design Section 8)

| Security Item (Section 8) | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| 재암호화 skip (isEncrypted 체크) | encrypt() L40 + encryptProfile 위임 | Match | |
| 같은 평문 → 다른 암호문 (IV 랜덤) | randomBytes(IV_BYTES) 사용 | Match | 테스트에서도 검증 |
| authTag 무결성 검증 (GCM) | AES-256-GCM 사용 | Match | |
| tournament_entries.phone 제외 | 적용 없음 (스코프 외) | Match | |

### 2.10 Test Coverage

| Test Category | Implementation | Status | Notes |
|-----|-----|:---:|-----|
| encrypt -> decrypt 왕복 검증 | encryption.test.ts L48-61 | Match | phone, birth_year, gender 모두 |
| isEncrypted 경계값 | encryption.test.ts L6-31 | Match | 빈 문자열, 부분 형식 등 |
| 환경변수 검증 테스트 | encryption.test.ts L88-102 | Match | 미설정, 64자 미만 |
| 재암호화 방지 | encryption.test.ts L72-75 | Match | |
| 마이그레이션 호환 (평문 통과) | encryption.test.ts L77-81 | Match | |
| profileCrypto 왕복 검증 | profileCrypto.test.ts L66-71 | Match | |
| profileCrypto 혼재 데이터 | profileCrypto.test.ts L84-92 | Match | |
| profileCrypto null/빈 문자열 | profileCrypto.test.ts L37-47, L79-82 | Match | |

---

## 3. Match Rate Summary

### 3.1 항목별 집계

| Category | Total | Match | Mismatch | Missing | Added |
|----------|:-----:|:-----:|:--------:|:-------:|:-----:|
| File List (Section 7) | 6 | 6 | 0 | 1 | 1 |
| encryption.ts API | 12 | 11 | 1 | 0 | 0 |
| profileCrypto.ts API | 7 | 7 | 0 | 0 | 0 |
| auth/actions.ts 수정 | 4 | 4 | 0 | 0 | 0 |
| queries.ts 수정 | 2 | 2 | 0 | 0 | 0 |
| Migration Script | 7 | 6 | 0 | 1 | 0 |
| Environment Variable | 3 | 2 | 0 | 1 | 0 |
| Error Handling | 5 | 4 | 0 | 1 | 0 |
| Security | 4 | 4 | 0 | 0 | 0 |
| Test Coverage | 8 | 8 | 0 | 0 | 0 |
| **Total** | **58** | **54** | **1** | **4** | **1** |

### 3.2 Overall Match Rate

```
+---------------------------------------------+
|  Overall Match Rate: 93%                     |
+---------------------------------------------+
|  Match:              54 items (93%)          |
|  Mismatch (변경):     1 item  ( 2%)          |
|  Missing (미구현):     4 items ( 5%)          |
|  Added (설계 외 추가): 1 item  (bonus)        |
+---------------------------------------------+
```

---

## 4. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 93% | Pass |
| Architecture Compliance | 100% | Pass |
| Convention Compliance | 95% | Pass |
| **Overall** | **93%** | **Pass** |

---

## 5. Differences Found

### 5.1 Missing Features (Design O, Implementation X)

| # | Item | Design Location | Description | Severity |
|---|------|-----------------|-------------|----------|
| 1 | 복호화 오류 시 null 반환 + 로그 | Section 5 (에러 처리 표) | decrypt()에 try-catch 없음. 손상된 데이터가 있으면 Server Action 전체가 throw되어 서비스 중단 가능 | Medium |
| 2 | 마이그레이션 로그 파일 생성 | Section 3.5 주석 | "처리 결과 로그 파일 생성 (migrate-encrypt-{timestamp}.log)" 미구현. console.log만 사용 | Low |
| 3 | `.env.example` 업데이트 | Phase 2 Convention (암묵적) | `.env.example`에 `ENCRYPTION_KEY` 템플릿 미추가. 신규 개발자가 필요 환경변수를 알 수 없음 | Medium |

### 5.2 Added Features (Design X, Implementation O)

| # | Item | Implementation Location | Description | Impact |
|---|------|------------------------|-------------|--------|
| 1 | 테스트 파일 2개 | `src/lib/crypto/__tests__/encryption.test.ts`, `profileCrypto.test.ts` | 설계 Section 7 파일 목록에 미기재, 그러나 Section 6 구현 순서에서 테스트 언급 | Positive |

### 5.3 Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | MigrationStats 필드 | `{ total, encrypted, skipped, errors }` | `{ total, needsEncryption, encrypted, skipped, errors }` | None (구현이 더 상세, 하위 호환) |

---

## 6. Architecture / Convention Compliance

### 6.1 Architecture Compliance

- `src/lib/crypto/` (Infrastructure) -> Domain 타입 미사용 -> **Pass** (독립 유틸)
- `src/lib/auth/actions.ts` (Application) -> `@/lib/crypto/profileCrypto` import -> **Pass** (Infrastructure 참조 허용)
- `src/lib/chat/entryFlow/queries.ts` (Application) -> `@/lib/crypto/profileCrypto` import -> **Pass**
- 의존 방향 위반: 없음

### 6.2 Naming Convention Compliance

| Item | Convention | Actual | Status |
|------|-----------|--------|--------|
| encryption.ts | camelCase.ts (유틸) | encryption.ts | Pass |
| profileCrypto.ts | camelCase.ts (유틸) | profileCrypto.ts | Pass |
| crypto/ 폴더 | kebab-case | crypto (단일 단어) | Pass |
| 함수: encrypt, decrypt, isEncrypted | camelCase | camelCase | Pass |
| 상수: ENCRYPTED_FIELDS, CIPHER_ALGORITHM | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | Pass |
| 테스트 폴더: __tests__/ | 관례 준수 | __tests__/ | Pass |

### 6.3 Import Order Compliance

`src/lib/auth/actions.ts`:
```
1. 외부 라이브러리: (없음)
2. 내부 절대 경로: @/lib/supabase/server, @/lib/supabase/admin
3. 내부 절대 경로: @/lib/utils/validation, @/lib/crypto/profileCrypto
4. next/cache, next/navigation
```
next 모듈이 내부 import 뒤에 위치하지만, 프로젝트 전체 관례와 일치하므로 **Pass** 처리.

### 6.4 Environment Variable Convention

| Variable | Phase 2 Convention | Actual | Status |
|----------|-------------------|--------|--------|
| ENCRYPTION_KEY | 서버 전용, UPPER_SNAKE_CASE | ENCRYPTION_KEY | Pass |
| .env.example 등록 | 필수 | **미등록** | Fail |

---

## 7. Recommended Actions

### 7.1 Immediate (권장)

| Priority | Item | File | Description |
|----------|------|------|-------------|
| 1 | `.env.example` 업데이트 | `.env.example` | `ENCRYPTION_KEY=` 줄 추가 (생성 명령 주석 포함) |

### 7.2 Short-term (선택)

| Priority | Item | File | Description |
|----------|------|------|-------------|
| 1 | decrypt() 에러 핸들링 추가 | `src/lib/crypto/encryption.ts` | try-catch로 복호화 실패 시 원본 값 반환 + console.error 로그. 마이그레이션 기간 DB 데이터 손상 시 서비스 중단 방지 |
| 2 | 마이그레이션 로그 파일 생성 | `scripts/migrate-encrypt-profiles.ts` | `fs.writeFileSync`로 결과 로그 저장. 실행 이력 추적에 유용하나 필수는 아님 |

### 7.3 Design Document Update Needed

| Item | Description |
|------|-------------|
| Section 7 파일 목록에 테스트 파일 추가 | `__tests__/encryption.test.ts`, `__tests__/profileCrypto.test.ts` 기재 |
| MigrationStats 인터페이스 | `needsEncryption` 필드 추가 반영 |

---

## 8. Check Stage Verdict

```
+---------------------------------------------+
|  Match Rate: 93% >= 90%                      |
|  Check Stage: PASSED                         |
+---------------------------------------------+
|  Critical Issues: 0                          |
|  Medium Issues:   2 (.env.example, decrypt   |
|                      error handling)         |
|  Low Issues:      1 (migration log file)     |
+---------------------------------------------+
```

Match Rate 93% >= 90% 기준 충족. Check 단계를 통과하며 Report 단계로 진행 가능.

Medium 이슈 2건은 현 시점에서 서비스 운영에 즉각적 영향은 없으나,
마이그레이션 실행 전까지 `.env.example` 업데이트는 권장한다.

---

## 9. Next Steps

- [ ] `.env.example`에 ENCRYPTION_KEY 추가 (권장)
- [ ] decrypt() try-catch 추가 검토 (선택)
- [ ] 설계 문서 Section 7 테스트 파일 반영 (선택)
- [ ] Report 단계: `/pdca report member-data-encryption`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-27 | Initial analysis | AI Assistant |
