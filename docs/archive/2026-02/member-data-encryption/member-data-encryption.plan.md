# Plan: 회원 개인정보 암호화

## 1. 개요

### 문제 정의
현재 `profiles` 테이블의 개인정보(전화번호, 생년, 성별)가 평문으로 저장되어 있음.
DB 유출 사고 발생 시 개인정보가 그대로 노출될 위험이 있음.

### 목표
민감 개인정보를 암호화하여 DB에 저장하고, 애플리케이션 레이어에서 복호화해 사용.
DB 직접 접근 시에도 원문 데이터를 알 수 없도록 보호.

---

## 2. 암호화 대상 필드

| 필드 | 민감도 | 이유 |
|------|--------|------|
| `phone` | 🔴 높음 | 전화번호는 개인 식별 핵심 정보 |
| `birth_year` | 🟡 중간 | 연령 추정 가능 |
| `gender` | 🟡 중간 | 개인 민감정보 |
| `name` | 🟠 검토 | 검색 필요성 때문에 **제외** (별도 논의) |
| `email` | — | Supabase Auth 관리 → 범위 외 |

> `name`은 대회 참가자 검색, 대진표 표시 등에 사용되므로 이번 범위에서 제외.
> 추후 별도 hash 컬럼으로 검색 가능하게 하는 방안 검토 가능.

---

## 3. 기술 방식

### 선택: 애플리케이션 레벨 AES-256-GCM

```
[클라이언트] → [Server Action: 암호화] → [Supabase DB: 암호문 저장]
[Supabase DB: 암호문] → [Server Action: 복호화] → [클라이언트]
```

#### 선택 이유
| 방식 | 장점 | 단점 |
|------|------|------|
| **App 레벨 (AES-256-GCM)** ✅ | 구현 단순, Node.js 내장, 키 관리 유연 | 앱 코드 탈취 시 위험 |
| DB 레벨 (pgsodium/pgcrypto) | DB 내부 처리, 앱 독립 | Supabase 설정 복잡, 마이그레이션 어려움 |
| Vault (외부 KMS) | 최고 수준 보안 | 과도한 복잡도, 비용 |

#### AES-256-GCM 특징
- **인증 암호화 (AEAD)**: 암호화 + 무결성 검증 동시 처리
- **IV(Nonce) 랜덤 생성**: 같은 값도 매번 다른 암호문 → 패턴 분석 불가
- Node.js 내장 `crypto` 모듈 사용 (외부 의존성 없음)

---

## 4. 키 관리

```
ENCRYPTION_KEY=<32바이트 hex 문자열>  # .env.local에 보관
```

- 키 생성: `openssl rand -hex 32`
- 환경변수 미설정 시 서버 시작 자체를 실패시킴 (fallback 금지)
- Vercel/운영 환경: Environment Variables에 등록
- 키 로테이션: 별도 마이그레이션 스크립트로 재암호화

---

## 5. DB 스키마 변경

암호화된 데이터는 기존 컬럼에 저장 (타입 변경 불필요 — 모두 `text`).
암호문 형식: `{iv_hex}:{authTag_hex}:{ciphertext_hex}` (Base64 인코딩)

```sql
-- 기존 컬럼 타입 유지 (text), 데이터만 교체
-- 기존 평문 데이터 마이그레이션 스크립트 필요
```

---

## 6. 구현 범위

### 신규 생성 파일
```
src/lib/crypto/
├── encryption.ts       # encrypt / decrypt / isEncrypted 유틸
└── profileCrypto.ts    # 프로필 전용 암/복호화 래퍼
```

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/auth/actions.ts` | 프로필 저장 시 encrypt 적용 |
| `src/app/profile/` 관련 | 프로필 읽기 시 decrypt 적용 |
| `src/lib/tournaments/actions.ts` | entry 저장 시 phone 암호화 확인 |
| `.env.local` | `ENCRYPTION_KEY` 추가 |

### 마이그레이션 스크립트
```
scripts/migrate-encrypt-profiles.ts  # 기존 평문 → 암호화 일괄 변환
```

---

## 7. 구현 단계

### Phase 1: 암호화 유틸 구현
- `src/lib/crypto/encryption.ts` 작성 (AES-256-GCM)
- `isEncrypted()` 헬퍼 (암호문 여부 판별 — 마이그레이션 기간 호환성)
- 단위 테스트 (encrypt → decrypt 왕복 검증)

### Phase 2: 프로필 저장 레이어 적용
- 프로필 생성/수정 Server Action에 encrypt 적용 (`phone`, `birth_year`, `gender`)
- 프로필 조회 시 decrypt 적용

### Phase 3: 연관 기능 확인
- 대회 참가 신청 시 phone 사용 경로 점검
- 관리자 페이지 회원 목록 표시 점검
- 채팅/알림 등 phone 참조 경로 전수 검토

### Phase 4: 기존 데이터 마이그레이션
- `scripts/migrate-encrypt-profiles.ts` 작성
- 스테이징에서 검증 후 운영 적용
- `isEncrypted()` 로 평문/암호문 혼재 기간 처리

---

## 8. 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| 키 분실 시 복호화 불가 | 키를 Vercel + 별도 안전한 위치에 이중 보관 |
| 마이그레이션 중 서비스 영향 | `isEncrypted()` 로 평문/암호문 동시 지원 (이중 처리 기간) |
| 검색 기능 저하 | phone 정확 일치 검색은 hash 컬럼 추가로 대응 가능 |
| 성능 저하 | AES-GCM은 µs 단위로 무시 가능한 수준 |

---

## 9. 완료 기준

- [ ] `phone`, `birth_year`, `gender` DB 저장 시 암호화 확인
- [ ] 프로필 페이지에서 복호화된 값이 정상 표시
- [ ] 기존 평문 데이터 마이그레이션 완료
- [ ] `ENCRYPTION_KEY` 미설정 시 서버 기동 실패 확인
- [ ] 암호화 전후 기능 동작 동일 (회원가입, 프로필 수정, 대회 신청)
