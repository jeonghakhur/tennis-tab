# 권한 시스템 빠른 참조

## 🎯 권한 레벨 요약

| 권한 | 레벨 | 설명 | 사용 예시 |
|------|------|------|-----------|
| **SUPER_ADMIN** | 4 | 전체 시스템 관리 | 서비스 소유자 |
| **ADMIN** | 3 | 모든 대회 관리 | 협회 임원 |
| **MANAGER** | 2 | 자신의 대회 관리 | 클럽 대표 |
| **USER** | 1 | 대회 참가 | 일반 동호인 |

## 📋 기능별 필요 권한

### 대회 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|------|---------|-------|-------------|
| 대회 조회 | ✅ | ✅ | ✅ | ✅ |
| 대회 생성 | ❌ | ✅ | ✅ | ✅ |
| 자신의 대회 수정 | ❌ | ✅ | ✅ | ✅ |
| 모든 대회 수정 | ❌ | ❌ | ✅ | ✅ |
| 대회 삭제 | ❌ | ✅ (본인) | ✅ | ✅ |

### 참가자 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|------|---------|-------|-------------|
| 참가 신청 | ✅ | ✅ | ✅ | ✅ |
| 참가 취소 | ✅ (본인) | ✅ | ✅ | ✅ |
| 참가 승인/거절 | ❌ | ✅ (본인 대회) | ✅ | ✅ |
| 참가자 강제 삭제 | ❌ | ✅ (본인 대회) | ✅ | ✅ |

### 대진표 & 경기
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|------|---------|-------|-------------|
| 대진표 조회 | ✅ | ✅ | ✅ | ✅ |
| 대진표 생성 | ❌ | ✅ (본인 대회) | ✅ | ✅ |
| 경기 결과 등록 | ✅ (본인 경기) | ✅ | ✅ | ✅ |
| 경기 결과 승인 | ❌ | ✅ (본인 대회) | ✅ | ✅ |

### 사용자 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|------|---------|-------|-------------|
| 프로필 조회 | ✅ | ✅ | ✅ | ✅ |
| 자신의 프로필 수정 | ✅ | ✅ | ✅ | ✅ |
| 다른 사용자 조회 | ✅ | ✅ | ✅ | ✅ |
| 권한 변경 | ❌ | ❌ | ❌ | ✅ |

## 🔧 자주 사용하는 SQL 쿼리

### 권한 확인
```sql
-- 내 권한 확인
SELECT email, name, role
FROM profiles
WHERE email = 'your-email@example.com';

-- 모든 관리자 조회
SELECT email, name, role
FROM profiles
WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
ORDER BY role;
```

### 권한 변경
```sql
-- USER를 MANAGER로 승격
UPDATE profiles
SET role = 'MANAGER'
WHERE email = 'user@example.com';

-- MANAGER를 ADMIN으로 승격
UPDATE profiles
SET role = 'ADMIN'
WHERE email = 'manager@example.com';

-- 권한 회수 (USER로 강등)
UPDATE profiles
SET role = 'USER'
WHERE email = 'admin@example.com';
```

### 대량 권한 변경
```sql
-- 특정 클럽 회원들을 MANAGER로 변경
UPDATE profiles
SET role = 'MANAGER'
WHERE club = '강남 테니스 클럽';

-- NULL 권한을 USER로 일괄 변경
UPDATE profiles
SET role = 'USER'
WHERE role IS NULL;
```

### 권한 통계
```sql
-- 권한별 사용자 수
SELECT
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY user_count DESC;

-- 최근 가입한 MANAGER 이상 사용자
SELECT
  email,
  name,
  role,
  created_at
FROM profiles
WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
ORDER BY created_at DESC
LIMIT 10;
```

## 💻 코드 예시

### 권한 확인
```typescript
import { useAuth } from '@/components/AuthProvider'
import { canManageTournaments, isAdmin } from '@/lib/auth/roles'

function TournamentActions() {
  const { profile } = useAuth()

  if (canManageTournaments(profile?.role)) {
    return <button>대회 생성</button>
  }

  return null
}
```

### 조건부 렌더링
```typescript
import { isAdmin, isSuperAdmin } from '@/lib/auth/roles'

function AdminMenu() {
  const { profile } = useAuth()

  return (
    <div>
      {isAdmin(profile?.role) && (
        <Link href="/admin/tournaments">대회 관리</Link>
      )}
      
      {isSuperAdmin(profile?.role) && (
        <Link href="/admin/users">사용자 관리</Link>
      )}
    </div>
  )
}
```

### 서버 액션에서 권한 확인
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'

export async function deleteTournament(id: string) {
  const supabase = await createClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!isAdmin(profile?.role)) {
    return { error: 'ADMIN 권한이 필요합니다.' }
  }

  // 삭제 로직...
}
```

## 🚨 보안 체크리스트

- [ ] SUPER_ADMIN은 2명 이하로 유지
- [ ] 퇴사자의 권한은 즉시 회수
- [ ] MANAGER 이상은 정기적으로 검토 (월 1회)
- [ ] 의심스러운 권한 변경 모니터링
- [ ] 프로덕션 데이터베이스 접근 제한
- [ ] SQL 직접 실행은 SUPER_ADMIN만

## 📚 관련 문서

- [상세 권한 가이드](./ROLES_GUIDE.md)
- [Supabase 설정 가이드](./SUPABASE_SETUP.md)
- [PRD - 회원 관리](./PRD.md#3-회원-관리)
