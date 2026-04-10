# 사용자 권한 시스템 가이드

## 📋 권한 레벨

Tennis Tab은 **5단계 권한 시스템**을 사용합니다. 정의: `src/lib/auth/roles.ts`

| 권한 | 레벨 | 설명 |
|------|:----:|------|
| SUPER_ADMIN | 4 | 전체 시스템 관리자 — 모든 기능 + 권한 관리 + 협회 생성 |
| ADMIN | 3 | 대회 관리자 — 모든 대회/회원/레슨/문의/결제 관리 |
| MANAGER | 2 | 대회 운영자 — 자신이 만든 대회만 관리 |
| USER | 1 | 일반 사용자 — 대회 참가, 경기 결과 등록 |
| RESTRICTED | 0 | 제한 사용자 — 일부 서비스 이용 제한 |

---

### 1. SUPER_ADMIN (최고 관리자)

**전용 기능** (ADMIN도 못 하는 것):
- ✅ 협회(Association) 생성/수정/삭제
- ✅ 클럽 회원 영구 삭제 (`permanentlyDeleteMember`) — 제거/탈퇴 회원 DB 완전 제거
- ✅ 협회 매니저 지정
- ✅ 모든 사용자(다른 SUPER_ADMIN 제외)의 권한 자유 변경

**제한**:
- ❌ 다른 SUPER_ADMIN의 권한은 변경 불가 (`changeUserRole`의 가드)
- ❌ 자신의 권한 변경 불가

**사용 예시**: 서비스 소유자, CTO, 개발팀 리더

---

### 2. ADMIN (관리자)

**대회 관리**:
- ✅ 모든 대회 생성, 수정, 삭제, 상태 변경
- ✅ 모든 참가자 승인/거절/결제/환불 처리
- ✅ 대진표 생성 및 관리
- ✅ 관리자 대리 참가 신청 시 **클럽 자유 선택** (`searchClubsByName`)

**시스템 운영**:
- ✅ 회원 관리 (`/admin/users`) — 목록 조회, 검색
- ✅ 권한 변경: **MANAGER ↔ USER만 부여/회수 가능** (`changeUserRole`)
- ✅ 레슨 관리 (`/admin/lessons`) — 코치·슬롯 관리
- ✅ 문의 관리 (`/admin/inquiries`) — 고객 문의 조회·답변
- ✅ FAQ 관리 (`/admin/faq`)
- ✅ 결제/환불 관리 (`confirmBankTransfer` 등)

**제한**:
- ❌ 협회(Association) 생성/관리 불가
- ❌ 클럽 회원 영구 삭제 불가
- ❌ SUPER_ADMIN/ADMIN 권한 부여·회수 불가 (상위 권한 사용자 조작 금지)
- ❌ 자신의 권한 변경 불가

**사용 예시**: 테니스 협회 임원, 전체 대회 총괄 담당자

---

### 3. MANAGER (운영자)

**권한**:
- ✅ 대회 생성
- ✅ **자신이 생성한 대회만** 수정, 삭제, 상태 변경
- ✅ 자신의 대회 참가자 승인·결제 처리
- ✅ 자신의 대회 대진표 생성
- ✅ 클럽 관리 (`/admin/clubs`)
- ✅ 클럽 회원 검색 (`/admin/clubs/members`)

**제한**:
- ❌ 타인의 대회 수정/삭제 불가 (`organizer_id` 비교로 차단)
- ❌ 회원 관리(`/admin/users`) 접근 불가
- ❌ 레슨/문의/FAQ 관리 불가
- ❌ 권한 변경 불가
- ❌ 관리자 대리 참가 신청의 클럽 선택 불가 (ADMIN+ 전용 기능)

**구현**: MANAGER는 라우트 진입은 되지만 `tournament.organizer_id !== user.id` 인 경우 `/admin/tournaments`로 redirect. 예: `src/app/admin/tournaments/[id]/entries/page.tsx:99-102`

**사용 예시**: 클럽 대표, 개별 대회 주최자

---

### 4. USER (일반 사용자)

**권한**:
- ✅ 대회 조회 및 참가 신청
- ✅ 자신의 참가 취소
- ✅ 경기 결과 등록
- ✅ 자신의 프로필 수정

**제한**:
- ❌ 대회 생성 불가
- ❌ `/admin/*` 접근 불가

**사용 예시**: 테니스 동호인, 대회 참가자

---

### 5. RESTRICTED (제한 사용자)

**권한**: USER와 유사하나 일부 서비스 이용이 제한됨.

**사용 예시**: 신고 누적·운영 규칙 위반 사용자 등 (운영 정책에 따름)

---

## 🛣 라우트 접근 제어 매트릭스

| 경로 | 체크 함수 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|:-:|:-:|:-:|:-:|
| `/admin` (레이아웃) | `canManageTournaments()` | ❌ | ✅ | ✅ | ✅ |
| `/admin/tournaments` | `canManageTournaments()` | ❌ | ✅ | ✅ | ✅ |
| `/admin/tournaments/[id]/entries` | `canManageTournaments()` + organizer 체크 | ❌ | ✅* | ✅ | ✅ |
| `/admin/tournaments/[id]/bracket` | `canManageTournaments()` + organizer 체크 | ❌ | ✅* | ✅ | ✅ |
| `/admin/clubs` | MANAGER+ | ❌ | ✅ | ✅ | ✅ |
| `/admin/clubs/members` | MANAGER+ | ❌ | ✅ | ✅ | ✅ |
| `/admin/users` | `isAdmin()` | ❌ | ❌ | ✅ | ✅ |
| `/admin/lessons` | `isAdmin()` 또는 코치 | ❌ | ❌ | ✅ | ✅ |
| `/admin/inquiries` | `isAdmin()` | ❌ | ❌ | ✅ | ✅ |
| `/admin/faq` | `isAdmin()` | ❌ | ❌ | ✅ | ✅ |
| `/admin/associations` | `isSuperAdmin()` 또는 협회 매니저 | ❌ | ❌ | ❌ | ✅ |

`*` = MANAGER는 자신이 `organizer_id`인 대회만

---

## 🔐 Row Level Security (RLS)

주요 테이블의 SQL 레벨 정책 (`supabase/migrations/*`):

### `profiles`
- 읽기: 누구나
- UPDATE: **자기 자신만** — 권한 변경은 RLS로 불가, 반드시 Server Action + admin client(Service Role Key) 경유

### `tournaments`
- 읽기: 누구나
- INSERT: MANAGER+
- UPDATE: `organizer_id = auth.uid()` OR role IN (`MANAGER`, `ADMIN`, `SUPER_ADMIN`)
- DELETE: `organizer_id = auth.uid()` OR role IN (`ADMIN`, `SUPER_ADMIN`) — **MANAGER는 자기 대회만 삭제**

### `tournament_entries`
- 읽기: 누구나
- INSERT/UPDATE: 본인 OR 대회 organizer OR role IN (`MANAGER`, `ADMIN`, `SUPER_ADMIN`)

### `bracket_matches` / `bracket_configs`
- `REPLICA IDENTITY FULL` (Realtime)
- UPDATE는 서버 액션 `checkBracketManagementAuth()`로 권한 검증

**보안 패턴**: Server Action의 mutation은 RLS에만 의존하지 말고 **반드시 `checkBracketManagementAuth()` 같은 명시적 권한 체크를 호출**할 것.

---

## 💡 권한 확인 헬퍼

`src/lib/auth/roles.ts`:

```typescript
import {
  hasMinimumRole,
  canManageTournaments,  // MANAGER+
  isAdmin,               // ADMIN+
  isSuperAdmin,          // SUPER_ADMIN only
  isRestricted,
} from '@/lib/auth/roles'

// 특정 권한 이상인지 확인
if (hasMinimumRole(user.role, 'MANAGER')) { /* ... */ }

// 대회 관리 권한 (MANAGER+)
if (canManageTournaments(user.role)) { /* ... */ }

// 관리자 기능 (ADMIN+)
if (isAdmin(user.role)) { /* ... */ }

// 최고 관리자 (SUPER_ADMIN only)
if (isSuperAdmin(user.role)) { /* ... */ }
```

**⚠ 주의**: `canChangeRole()` (`roles.ts:71`)은 SUPER_ADMIN-only 체크 헬퍼이지만, 실제 권한 변경 로직은 `src/lib/auth/admin.ts`의 `changeUserRole()`이 직접 구현합니다. 권한 변경 정책이 바뀌면 **`changeUserRole()`을 수정**해야 합니다.

---

## 🔧 권한 설정 방법

### 첫 SUPER_ADMIN 설정 (Supabase SQL Editor)

```sql
UPDATE profiles
SET role = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';

-- 확인
SELECT id, email, name, role
FROM profiles
WHERE role = 'SUPER_ADMIN';
```

### 웹 UI에서 권한 변경

```
/admin/users → 사용자 목록 → 권한 Select 변경
```

- ADMIN: MANAGER ↔ USER 변경만 가능
- SUPER_ADMIN: 다른 SUPER_ADMIN을 제외한 모든 역할 변경 가능
- 자기 자신 변경 불가

### 코드로 권한 변경

```typescript
import { changeUserRole } from '@/lib/auth/admin'

// ADMIN 이상만 실행 가능 — 내부에서 targetRole/newRole 조합 검증
const result = await changeUserRole(userId, 'MANAGER')
if (result.error) console.error(result.error)
```

---

## 🚨 보안 주의사항

1. **SUPER_ADMIN 최소화**: 2명 이하로 유지 권장
2. **권한 변경 감사 로그**: 추후 구현 예정 — 현재는 DB `updated_at` 으로만 추적
3. **정기 검토**: 월 1회 ADMIN/MANAGER 리스트 검토
4. **즉시 회수**: 퇴사자·탈퇴자 권한은 즉시 USER로 강등
5. **Server Action 권한 중복 확인**: RLS만 믿지 말고 `isAdmin()`, `canManageTournaments()`, `organizer_id` 비교를 mutation 진입부에서 명시 호출
6. **Service Role Key 보호**: `createAdminClient()`는 RLS 우회 — 사용자 입력으로 쿼리 조건을 만들 때 validation 필수

---

## 📊 권한 통계 쿼리

```sql
-- 권한별 사용자 수
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

-- NULL 권한(오류 가능성)
SELECT id, email, name
FROM profiles
WHERE role IS NULL;

-- 최근 1주일 ADMIN+ 신규
SELECT email, name, role, created_at
FROM profiles
WHERE role IN ('SUPER_ADMIN', 'ADMIN')
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## 🔄 권한 일괄 변경

```sql
-- NULL 권한을 USER로 일괄 초기화
UPDATE profiles
SET role = 'USER'
WHERE role IS NULL;

-- 특정 클럽 회원을 MANAGER로 승격
UPDATE profiles
SET role = 'MANAGER'
WHERE club = '강남 테니스 클럽';
```

---

## 📞 문의

권한 관련 문제 발생 시:
1. Supabase Table Editor → `profiles` 테이블 확인
2. SQL Editor에서 `SELECT role FROM profiles WHERE id = ...`
3. `src/lib/auth/roles.ts` 및 `admin.ts` 로직 점검
4. 개발팀 문의
