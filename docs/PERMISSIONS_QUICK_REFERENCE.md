# 권한 시스템 빠른 참조

## 🎯 권한 레벨 요약

| 권한 | 레벨 | 설명 | 사용 예시 |
|------|:----:|------|-----------|
| **SUPER_ADMIN** | 4 | 전체 시스템 관리 + 협회 생성 + 권한 변경 전권 | 서비스 소유자 |
| **ADMIN** | 3 | 모든 대회/회원/레슨/문의/결제 관리 | 협회 임원 |
| **MANAGER** | 2 | 자신이 만든 대회만 관리 | 클럽 대표 |
| **USER** | 1 | 대회 참가, 경기 결과 등록 | 일반 동호인 |
| **RESTRICTED** | 0 | 일부 서비스 제한 | 신고 누적자 |

정의: `src/lib/auth/roles.ts`

## 📋 기능별 필요 권한

### 대회 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 대회 조회 | ✅ | ✅ | ✅ | ✅ |
| 대회 생성 | ❌ | ✅ | ✅ | ✅ |
| 자신의 대회 수정 | ❌ | ✅ | ✅ | ✅ |
| 모든 대회 수정 | ❌ | ❌ | ✅ | ✅ |
| 자신의 대회 삭제 | ❌ | ✅ | ✅ | ✅ |
| 모든 대회 삭제 | ❌ | ❌ | ✅ | ✅ |
| 대회 상태 변경 | ❌ | ✅ (본인) | ✅ | ✅ |

### 참가자 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 참가 신청 | ✅ | ✅ | ✅ | ✅ |
| 참가 취소(본인) | ✅ | ✅ | ✅ | ✅ |
| 참가 승인/거절 | ❌ | ✅ (본인 대회) | ✅ | ✅ |
| 참가자 강제 삭제 | ❌ | ✅ (본인 대회) | ✅ | ✅ |
| 대리 참가 신청 — 클럽 자유 선택 | ❌ | ❌ | ✅ | ✅ |
| 결제 확인 / 환불 | ❌ | ✅ (본인 대회) | ✅ | ✅ |

### 대진표 & 경기
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 대진표 조회 | ✅ | ✅ | ✅ | ✅ |
| 대진표 생성 | ❌ | ✅ (본인 대회) | ✅ | ✅ |
| 경기 결과 등록 | ✅ (본인 경기) | ✅ | ✅ | ✅ |
| 경기 결과 수정/승인 | ❌ | ✅ (본인 대회) | ✅ | ✅ |

### 사용자 관리
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 프로필 조회 | ✅ | ✅ | ✅ | ✅ |
| 자신의 프로필 수정 | ✅ | ✅ | ✅ | ✅ |
| 전체 사용자 목록 조회 | ❌ | ❌ | ✅ | ✅ |
| USER ↔ MANAGER 권한 변경 | ❌ | ❌ | ✅ | ✅ |
| ADMIN 권한 부여/회수 | ❌ | ❌ | ❌ | ✅ |
| SUPER_ADMIN 권한 부여 | ❌ | ❌ | ❌ | ✅ (본인 제외) |
| 자기 자신 권한 변경 | ❌ | ❌ | ❌ | ❌ |

### 클럽 & 협회
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 클럽 조회 | ✅ | ✅ | ✅ | ✅ |
| 클럽 생성/수정 | ❌ | ✅ | ✅ | ✅ |
| 클럽 회원 검색(전체) | ❌ | ✅ | ✅ | ✅ |
| 클럽 회원 영구 삭제 | ❌ | ❌ | ❌ | ✅ |
| 협회 생성/수정/삭제 | ❌ | ❌ | ❌ | ✅ |

### 시스템 운영 (레슨/문의/FAQ)
| 기능 | USER | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|:-:|
| 레슨 신청 (고객) | ✅ | ✅ | ✅ | ✅ |
| 레슨 슬롯/코치 관리 | ❌ | ❌ | ✅ | ✅ |
| 문의 조회/답변 | ❌ | ❌ | ✅ | ✅ |
| FAQ 관리 | ❌ | ❌ | ✅ | ✅ |

## 🛣 라우트 접근

| 경로 | MANAGER | ADMIN | SUPER_ADMIN |
|------|:-:|:-:|:-:|
| `/admin/tournaments` | ✅ | ✅ | ✅ |
| `/admin/tournaments/[id]/entries` | ✅* | ✅ | ✅ |
| `/admin/tournaments/[id]/bracket` | ✅* | ✅ | ✅ |
| `/admin/clubs`, `/admin/clubs/members` | ✅ | ✅ | ✅ |
| `/admin/users` | ❌ | ✅ | ✅ |
| `/admin/lessons` | ❌ | ✅ | ✅ |
| `/admin/inquiries` | ❌ | ✅ | ✅ |
| `/admin/faq` | ❌ | ✅ | ✅ |
| `/admin/associations` | ❌ | ❌ | ✅ |

`*` = MANAGER는 자신이 `organizer_id`인 대회만 (라우트 진입 시 체크)

## 🔧 자주 사용하는 SQL

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
ORDER BY role DESC, created_at;
```

### 권한 변경 (SQL 직접)
```sql
-- USER를 MANAGER로 승격
UPDATE profiles SET role = 'MANAGER'
WHERE email = 'user@example.com';

-- MANAGER를 ADMIN으로 승격 (SUPER_ADMIN 작업 권장)
UPDATE profiles SET role = 'ADMIN'
WHERE email = 'manager@example.com';

-- 권한 회수 (USER로 강등)
UPDATE profiles SET role = 'USER'
WHERE email = 'admin@example.com';
```

### 권한 통계
```sql
SELECT role, COUNT(*) AS user_count
FROM profiles
GROUP BY role
ORDER BY user_count DESC;
```

## 💻 코드 예시

### 권한 확인 (클라이언트)
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
        <Link href="/admin/users">회원 관리</Link>
      )}
      {isSuperAdmin(profile?.role) && (
        <Link href="/admin/associations">협회 관리</Link>
      )}
    </div>
  )
}
```

### Server Action 권한 체크
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { isAdmin, canManageTournaments } from '@/lib/auth/roles'

export async function deleteTournament(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 본인 대회는 MANAGER, 타인 대회는 ADMIN+ 필요
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('organizer_id')
    .eq('id', id)
    .single()

  const isOwner = tournament?.organizer_id === user.id
  const allowed = isOwner
    ? canManageTournaments(profile?.role)
    : isAdmin(profile?.role)

  if (!allowed) return { error: '권한이 없습니다.' }

  // 삭제 로직...
}
```

### 권한 변경 Server Action
```typescript
import { changeUserRole } from '@/lib/auth/admin'

// ADMIN: MANAGER/USER만 변경 가능
// SUPER_ADMIN: 다른 SUPER_ADMIN 제외 전부 변경 가능
const result = await changeUserRole(userId, 'MANAGER')
if (result.error) console.error(result.error)
```

## 🚨 보안 체크리스트

- [ ] SUPER_ADMIN은 2명 이하로 유지
- [ ] 퇴사자의 권한은 즉시 회수 (→ USER)
- [ ] MANAGER 이상은 월 1회 정기 검토
- [ ] 의심스러운 권한 변경 모니터링
- [ ] 프로덕션 Service Role Key 노출 금지
- [ ] Server Action 진입부에서 RLS와 독립적으로 권한 체크 중복 호출
- [ ] `organizer_id` 비교를 MANAGER 대상 mutation에서 누락하지 말 것

## 📚 관련 문서

- [상세 권한 가이드](./ROLES_GUIDE.md)
- [Supabase 설정 가이드](./SUPABASE_SETUP.md)
- [PRD - 회원 관리](./PRD.md#3-회원-관리)
