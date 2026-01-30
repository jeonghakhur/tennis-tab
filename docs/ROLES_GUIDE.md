# 사용자 권한 시스템 가이드

## 📋 권한 레벨

Tennis Tab은 4단계 권한 시스템을 사용합니다.

### 1. SUPER_ADMIN (최고 관리자)

**권한:**
- ✅ 모든 기능 접근 가능
- ✅ 다른 사용자의 권한 변경
- ✅ 모든 대회 생성, 수정, 삭제
- ✅ 전체 시스템 설정 관리
- ✅ 모든 참가자 관리

**제한:**
- ❌ 다른 SUPER_ADMIN의 권한은 변경 불가

**사용 예시:**
- 서비스 소유자
- CTO, 개발팀 리더

---

### 2. ADMIN (관리자)

**권한:**
- ✅ 모든 대회 생성, 수정, 삭제
- ✅ 모든 참가자 관리
- ✅ 대진표 생성 및 관리
- ✅ 전체 통계 조회

**제한:**
- ❌ 사용자 권한 변경 불가
- ❌ 시스템 설정 변경 불가

**사용 예시:**
- 테니스 협회 임원
- 전체 대회 총괄 담당자

---

### 3. MANAGER (운영자)

**권한:**
- ✅ 자신이 생성한 대회 관리
- ✅ 자신의 대회 참가자 관리
- ✅ 자신의 대회 대진표 생성
- ✅ 경기 결과 승인

**제한:**
- ❌ 다른 사람의 대회 수정 불가
- ❌ 전체 통계 조회 불가

**사용 예시:**
- 클럽 대표
- 개별 대회 주최자

---

### 4. USER (일반 사용자)

**권한:**
- ✅ 대회 검색 및 조회
- ✅ 대회 참가 신청
- ✅ 경기 결과 등록
- ✅ 자신의 프로필 수정

**제한:**
- ❌ 대회 생성 불가
- ❌ 다른 사용자 정보 수정 불가

**사용 예시:**
- 테니스 동호인
- 대회 참가자

---

## 🔧 권한 설정 방법

### 첫 번째 SUPER_ADMIN 설정

1. Supabase SQL Editor에서 실행:

```sql
-- 특정 사용자를 SUPER_ADMIN으로 설정
UPDATE profiles
SET role = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';
```

2. 확인:

```sql
SELECT id, email, name, role
FROM profiles
WHERE role = 'SUPER_ADMIN';
```

### 웹 UI에서 권한 변경 (개발 예정)

SUPER_ADMIN은 관리자 페이지에서 다른 사용자의 권한을 변경할 수 있습니다:

```
/admin/users → 사용자 목록 → 권한 변경
```

### 코드로 권한 변경

```typescript
import { changeUserRole } from '@/lib/auth/admin'

// SUPER_ADMIN만 실행 가능
await changeUserRole(userId, 'ADMIN')
```

---

## 🔐 Row Level Security (RLS)

각 권한별 RLS 정책:

### Profiles 테이블
- 모든 사용자: 읽기 가능
- 본인: 자신의 프로필 수정 가능
- SUPER_ADMIN: 모든 프로필 수정 가능

### Tournaments 테이블
- 모든 사용자: 읽기 가능
- MANAGER 이상: 대회 생성 가능
- 대회 주최자 또는 ADMIN 이상: 대회 수정 가능

### Matches 테이블
- 모든 사용자: 읽기 가능
- 대회 주최자 또는 MANAGER 이상: 경기 관리 가능

---

## 💡 권한 확인 헬퍼 함수

`src/lib/auth/roles.ts`에서 제공:

```typescript
import {
  hasMinimumRole,
  canManageTournaments,
  isAdmin,
  isSuperAdmin,
  canChangeRole,
} from '@/lib/auth/roles'

// 특정 권한 이상인지 확인
if (hasMinimumRole(user.role, 'MANAGER')) {
  // MANAGER 이상만 실행
}

// 대회 관리 권한 확인
if (canManageTournaments(user.role)) {
  // 대회 생성/수정 가능
}

// 관리자 권한 확인
if (isAdmin(user.role)) {
  // 관리자 기능 사용 가능
}

// 최고 관리자 확인
if (isSuperAdmin(user.role)) {
  // 권한 변경 등 특수 기능
}
```

---

## 🚨 보안 주의사항

1. **SUPER_ADMIN 최소화**: SUPER_ADMIN은 최소한의 인원만 부여
2. **권한 변경 로그**: 모든 권한 변경은 로그로 기록 (추후 구현)
3. **정기 검토**: 사용자 권한을 정기적으로 검토
4. **즉시 회수**: 퇴사자 등의 권한은 즉시 회수

---

## 📊 권한별 통계 조회

```sql
-- 권한별 사용자 수
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

-- 권한이 NULL인 사용자 (오류 가능성)
SELECT id, email, name
FROM profiles
WHERE role IS NULL;
```

---

## 🔄 권한 마이그레이션

기존 사용자들의 권한을 일괄 변경:

```sql
-- 모든 NULL 권한을 USER로 변경
UPDATE profiles
SET role = 'USER'
WHERE role IS NULL;

-- 특정 클럽 회원들을 MANAGER로 변경
UPDATE profiles
SET role = 'MANAGER'
WHERE club = '강남 테니스 클럽';
```

---

## 📞 문의

권한 관련 문제가 발생하면:
1. Supabase > Table Editor > profiles 테이블 확인
2. SQL Editor에서 직접 권한 확인
3. 개발팀에 문의
