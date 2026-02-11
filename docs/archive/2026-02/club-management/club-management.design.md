# club-management Design Document

> **Summary**: 협회-클럽-회원 계층 구조의 상세 설계. ADMIN→협회, MANAGER→클럽, 가입/비가입 회원 통합 관리
>
> **Project**: tennis-tab
> **Version**: 0.1
> **Author**: AI Assistant
> **Date**: 2026-02-11
> **Status**: Draft
> **Planning Doc**: [club-management.plan.md](../../01-plan/features/club-management.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **기존 Admin 패턴 준수**: `AdminSidebar` + `AdminHeader` 레이아웃 내에서 협회/클럽 메뉴 추가
2. **공통 컴포넌트 재사용**: `Modal`, `AlertDialog`, `ConfirmDialog`, `Toast`, `LoadingOverlay` 필수 사용
3. **CSS 변수 기반 테마**: `globals.css`의 `--bg-primary`, `--text-primary`, `--accent-color` 등 사용, `dark:` prefix 최소화
4. **가입/비가입 회원 통합**: `club_members` 단일 테이블에서 `is_registered` 불리언으로 분기
5. **profiles 자동 동기화**: 가입 회원이 클럽 선택 시 profiles 데이터 자동 매핑

### 1.2 Design Principles

- 기존 Admin 페이지(대회 관리, 유저 관리) 톤앤매너 유지
- Server Actions + Admin Client(Service Role Key)로 권한 우회 패턴 유지
- 조기 반환(Early Return)으로 권한 검증 간결화
- 시맨틱 CSS 클래스(`.glass-card`, `.btn-primary`) + Tailwind 레이아웃 유틸리티

---

## 2. Architecture

### 2.1 Component Diagram

```
[Admin Layout]
src/app/admin/layout.tsx (기존)
  │
  ├── AdminSidebar ← 협회/클럽 메뉴 항목 추가
  │     ├── 대시보드
  │     ├── 유저관리
  │     ├── 대회관리
  │     ├── 협회관리 (ADMIN/SUPER_ADMIN만 표시)    ← NEW
  │     └── 클럽관리 (MANAGER/ADMIN/SUPER_ADMIN)   ← NEW
  │
  ├── [/admin/associations]          ← ADMIN 전용
  │     ├── page.tsx                   내 협회 (1개 제한)
  │     ├── new/page.tsx               협회 생성 폼
  │     └── [id]/
  │           ├── page.tsx             협회 수정
  │           └── managers/page.tsx    매니저 지정/해제
  │
  └── [/admin/clubs]                 ← MANAGER 전용
        ├── page.tsx                   내 클럽 목록
        ├── new/page.tsx               클럽 생성 폼
        └── [id]/page.tsx              클럽 수정 + 회원 관리

[공개 페이지]
src/app/clubs/
  ├── page.tsx                         클럽 목록 (검색, 필터)
  └── [id]/page.tsx                    클럽 상세 (정보 + 회원 목록)

[프로필]
src/app/my/profile/edit/page.tsx       ← 클럽 선택 UI 추가 (기존 club 문자열 → 클럽 선택)
```

### 2.2 Data Flow

```
=== 협회 생성 (ADMIN) ===
ADMIN → /admin/associations/new → AssociationForm
  → createAssociation() Server Action
    → checkAssociationAdminAuth() (ADMIN 확인 + 기존 협회 없음 확인)
    → admin.from('associations').insert() (이름, 지역, 소개, 협회장/사무장 연락처)
    → Toast("협회가 생성되었습니다")

=== 매니저 지정 (ADMIN) ===
ADMIN → /admin/associations/[id]/managers → ManagerList
  → 사용자 검색 (이름/이메일)
  → assignManager(associationId, userId) Server Action
    → checkAssociationOwnerAuth() (해당 협회 ADMIN 확인)
    → profiles.role을 MANAGER로 변경
    → association_managers에 INSERT
    → Toast("매니저로 지정되었습니다")

=== 클럽 생성 (MANAGER) ===
MANAGER → /admin/clubs/new → ClubForm
  → createClub() Server Action
    → checkClubManagementAuth() (MANAGER 확인)
    → 협회 소속 매니저? → association_id 자동 설정
    → 미소속 매니저? → association_id = null
    → clubs INSERT + club_members INSERT (OWNER 역할)
    → Toast("클럽이 생성되었습니다")

=== 비가입 회원 등록 (클럽 owner/admin) ===
클럽 owner → /admin/clubs/[id] → MemberList → "회원 추가" 버튼
  → AddMemberModal (이름, 생년월일, 성별, 연락처, 입문년도, 점수 입력)
  → addUnregisteredMember() Server Action
    → club_members INSERT (is_registered=false, user_id=null)
    → Toast("회원이 등록되었습니다")

=== 가입 회원 클럽 선택 (프로필 수정) ===
USER → /my/profile/edit → 클럽 선택 드롭다운
  → joinClubAsRegistered(clubId) Server Action
    → profiles에서 name, phone, start_year, rating 읽기
    → club_members INSERT (is_registered=true, user_id=본인)
    → profiles.club, club_city, club_district 업데이트 (하위 호환)
    → Toast("클럽에 가입되었습니다")

=== 회원 제거 (클럽 owner/admin) ===
클럽 owner → MemberList → "제거" 버튼
  → ConfirmDialog("정말 제거하시겠습니까?")
  → 사유 입력 Modal
  → removeMember(memberId, reason) Server Action
    → club_members.status = 'REMOVED', status_reason = reason
    → Toast("회원이 제거되었습니다")
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| 협회 관리 페이지 | `associations` 테이블, `checkAssociationAdminAuth()` | 협회 CRUD |
| 클럽 관리 페이지 | `clubs` 테이블, `association_managers` 테이블 | 클럽 CRUD + 협회 소속 판별 |
| 회원 관리 | `club_members` 테이블, `profiles` 테이블 | 가입/비가입 회원 통합 관리 |
| 프로필 클럽 선택 | `clubs` 테이블, `club_members` 테이블 | 가입 회원 클럽 연결 |
| AdminSidebar | `profiles.role` | 역할별 메뉴 필터링 |

---

## 3. Data Model

### 3.1 Entity Definition

```typescript
// src/lib/associations/types.ts

interface Association {
  id: string;
  name: string;
  region: string | null;
  district: string | null;
  description: string | null;
  president_name: string | null;
  president_phone: string | null;
  president_email: string | null;
  secretary_name: string | null;
  secretary_phone: string | null;
  secretary_email: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AssociationManager {
  id: string;
  association_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  // JOIN 결과
  profiles?: {
    name: string;
    email: string;
    phone: string | null;
  };
}

// src/lib/clubs/types.ts

type ClubJoinType = 'OPEN' | 'APPROVAL' | 'INVITE_ONLY';
type ClubMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type ClubMemberStatus = 'PENDING' | 'INVITED' | 'ACTIVE' | 'LEFT' | 'REMOVED';
type GenderType = 'MALE' | 'FEMALE';

interface Club {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  join_type: ClubJoinType;
  association_id: string | null;   // null = 독립 클럽
  max_members: number | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // JOIN 결과
  associations?: { name: string } | null;
}

interface ClubMember {
  id: string;
  club_id: string;
  user_id: string | null;          // null = 비가입 회원
  is_registered: boolean;

  // 회원 정보
  name: string;
  birth_date: string | null;
  gender: GenderType | null;
  phone: string | null;
  start_year: string | null;
  rating: number | null;

  role: ClubMemberRole;
  status: ClubMemberStatus;
  status_reason: string | null;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

// Server Action 입력 타입
interface CreateClubInput {
  name: string;
  description?: string;
  city?: string;
  district?: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  join_type?: ClubJoinType;
  max_members?: number;
}

interface UnregisteredMemberInput {
  name: string;
  birth_date?: string;
  gender?: GenderType;
  phone?: string;
  start_year?: string;
  rating?: number;
}

interface CreateAssociationInput {
  name: string;
  region?: string;
  district?: string;
  description?: string;
  president_name?: string;
  president_phone?: string;
  president_email?: string;
  secretary_name?: string;
  secretary_phone?: string;
  secretary_email?: string;
}
```

### 3.2 Entity Relationships

```
[profiles] 1 ──── 1 [associations]     (ADMIN은 협회 1개만 생성)
     │                    │
     │                    └── 1 ──── N [association_managers]
     │                                      │
     │                                      └── N ──── 1 [profiles] (MANAGER)
     │
     └── 1 ──── N [club_members]
                       │
                       └── N ──── 1 [clubs] ──── N? [associations]
                                                  (nullable: 독립 클럽)
```

### 3.3 Database Schema

Plan 문서 8.1절 참조. 주요 제약 조건:

| 테이블 | 제약 | 설명 |
|--------|------|------|
| `associations` | `UNIQUE(created_by)` | ADMIN 1인 1협회 |
| `association_managers` | `UNIQUE(association_id, user_id)` | 중복 매니저 방지 |
| `clubs` | `association_id` nullable | 독립 클럽 허용 |
| `club_members` | `UNIQUE(club_id, user_id)` | 가입 회원 중복 방지 |
| `club_members` | `CHECK(user_id IS NOT NULL OR name IS NOT NULL)` | 비가입은 이름 필수 |

---

## 4. Server Actions 상세 설계

### 4.1 권한 검증 헬퍼

```typescript
// src/lib/associations/actions.ts

/** ADMIN 권한 + 협회 소유 확인 */
async function checkAssociationOwnerAuth(associationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다');

  const profile = await getProfile(user.id);
  if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
    throw new Error('권한이 없습니다');
  }

  // SUPER_ADMIN은 모든 협회 접근 가능
  if (profile.role === 'SUPER_ADMIN') return profile;

  const association = await admin
    .from('associations')
    .select('created_by')
    .eq('id', associationId)
    .single();

  if (association.data?.created_by !== user.id) {
    throw new Error('해당 협회의 관리자가 아닙니다');
  }

  return profile;
}

// src/lib/clubs/actions.ts

/** 클럽 owner/admin 권한 확인 */
async function checkClubOwnerAuth(clubId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다');

  const profile = await getProfile(user.id);

  // SUPER_ADMIN은 모든 클럽 접근 가능
  if (profile.role === 'SUPER_ADMIN') return { profile, clubRole: 'OWNER' as const };

  const member = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single();

  if (!member.data || !['OWNER', 'ADMIN'].includes(member.data.role)) {
    throw new Error('클럽 관리 권한이 없습니다');
  }

  return { profile, clubRole: member.data.role };
}
```

### 4.2 핵심 Server Actions

```typescript
// === 협회 관리 ===

// 협회 생성 (ADMIN, 1인 1협회 제한)
export async function createAssociation(data: CreateAssociationInput) {
  'use server';
  const user = await getCurrentUser();
  const profile = await getProfile(user.id);

  if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
    throw new Error('ADMIN 권한이 필요합니다');
  }

  // 기존 협회 존재 확인 (UNIQUE 제약으로도 보호되지만 UX용 사전 검증)
  const existing = await admin
    .from('associations')
    .select('id')
    .eq('created_by', user.id)
    .maybeSingle();

  if (existing.data) {
    throw new Error('이미 협회를 보유하고 있습니다 (1인 1협회 제한)');
  }

  const { error } = await admin.from('associations').insert({
    ...data,
    created_by: user.id,
  });

  if (error) throw new Error('협회 생성에 실패했습니다');
  revalidatePath('/admin/associations');
}

// 매니저 지정
export async function assignManager(associationId: string, userId: string) {
  'use server';
  await checkAssociationOwnerAuth(associationId);
  const user = await getCurrentUser();

  // 대상 사용자 role을 MANAGER로 변경
  await admin
    .from('profiles')
    .update({ role: 'MANAGER', updated_at: new Date().toISOString() })
    .eq('id', userId);

  // association_managers에 추가
  const { error } = await admin.from('association_managers').insert({
    association_id: associationId,
    user_id: userId,
    assigned_by: user.id,
  });

  if (error) throw new Error('매니저 지정에 실패했습니다');
  revalidatePath(`/admin/associations/${associationId}/managers`);
}

// === 클럽 관리 ===

// 클럽 생성 (MANAGER)
export async function createClub(data: CreateClubInput) {
  'use server';
  const user = await getCurrentUser();
  const profile = await getProfile(user.id);

  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
    throw new Error('MANAGER 이상 권한이 필요합니다');
  }

  // 협회 소속 매니저인지 확인
  const managerAssoc = await admin
    .from('association_managers')
    .select('association_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const associationId = managerAssoc?.data?.association_id ?? null;

  // 클럽 생성
  const { data: club, error } = await admin
    .from('clubs')
    .insert({
      ...data,
      association_id: associationId,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !club) throw new Error('클럽 생성에 실패했습니다');

  // 생성자를 OWNER로 등록
  await admin.from('club_members').insert({
    club_id: club.id,
    user_id: user.id,
    is_registered: true,
    name: profile.name,
    phone: profile.phone,
    start_year: profile.start_year,
    rating: profile.rating,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  revalidatePath('/admin/clubs');
}

// 비가입 회원 직접 등록
export async function addUnregisteredMember(clubId: string, data: UnregisteredMemberInput) {
  'use server';
  await checkClubOwnerAuth(clubId);

  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: null,
    is_registered: false,
    ...data,
    role: 'MEMBER',
    status: 'ACTIVE',
  });

  if (error) throw new Error('회원 등록에 실패했습니다');
  revalidatePath(`/admin/clubs/${clubId}`);
}

// 가입 회원 클럽 가입 (프로필에서 클럽 선택)
export async function joinClubAsRegistered(clubId: string) {
  'use server';
  const user = await getCurrentUser();
  const profile = await getProfile(user.id);

  // 클럽 존재 확인 + join_type 확인
  const club = await admin
    .from('clubs')
    .select('id, name, join_type, city, district')
    .eq('id', clubId)
    .single();

  if (!club.data) throw new Error('클럽을 찾을 수 없습니다');

  const status = club.data.join_type === 'OPEN' ? 'ACTIVE'
    : club.data.join_type === 'APPROVAL' ? 'PENDING'
    : null; // INVITE_ONLY는 가입 불가

  if (!status) throw new Error('이 클럽은 초대로만 가입할 수 있습니다');

  // profiles 데이터로 club_members 자동 채움
  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: user.id,
    is_registered: true,
    name: profile.name,
    phone: profile.phone,
    start_year: profile.start_year,
    rating: profile.rating,
    role: 'MEMBER',
    status,
  });

  if (error?.code === '23505') throw new Error('이미 가입된 클럽입니다');
  if (error) throw new Error('클럽 가입에 실패했습니다');

  // profiles.club 등 하위 호환 필드 업데이트
  await admin
    .from('profiles')
    .update({
      club: club.data.name,
      club_city: club.data.city,
      club_district: club.data.district,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  revalidatePath('/my/profile');
}

// 회원 제거 (사유 필수)
export async function removeMember(memberId: string, reason: string) {
  'use server';
  const member = await admin
    .from('club_members')
    .select('club_id, role')
    .eq('id', memberId)
    .single();

  if (!member.data) throw new Error('회원을 찾을 수 없습니다');
  if (member.data.role === 'OWNER') throw new Error('클럽 소유자는 제거할 수 없습니다');

  await checkClubOwnerAuth(member.data.club_id);

  const { error } = await admin
    .from('club_members')
    .update({
      status: 'REMOVED',
      status_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId);

  if (error) throw new Error('회원 제거에 실패했습니다');
  revalidatePath(`/admin/clubs/${member.data.club_id}`);
}
```

---

## 5. UI/UX Design

### 5.1 AdminSidebar 메뉴 추가

```typescript
// src/components/admin/AdminSidebar.tsx에 항목 추가

// 기존 메뉴
{ label: '대시보드', href: '/admin', icon: LayoutDashboard },
{ label: '유저관리', href: '/admin/users', icon: Users, roles: ['SUPER_ADMIN'] },
{ label: '대회관리', href: '/admin/tournaments', icon: Trophy },

// 추가 메뉴
{ label: '협회관리', href: '/admin/associations', icon: Building2, roles: ['ADMIN', 'SUPER_ADMIN'] },
{ label: '클럽관리', href: '/admin/clubs', icon: Shield, roles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
```

### 5.2 협회 관리 페이지

#### `/admin/associations` — 내 협회 관리

```
┌──────────────────────────────────────────────────┐
│  협회 관리                         [협회 생성] btn │  ← 이미 협회가 있으면 버튼 숨김
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ glass-card ────────────────────────────────┐ │
│  │  마포구테니스협회                              │ │
│  │  서울특별시 마포구                              │ │
│  │  매니저 5명 · 클럽 12개                        │ │
│  │                                              │ │
│  │  [협회 수정]  [매니저 관리]                     │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  협회 미보유 시:                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │  아직 협회를 생성하지 않았습니다.                 │ │
│  │  [협회 생성하기] btn-primary                   │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

#### `/admin/associations/[id]/managers` — 매니저 관리

```
┌──────────────────────────────────────────────────┐
│  ← 뒤로   마포구테니스협회 · 매니저 관리            │
├──────────────────────────────────────────────────┤
│                                                  │
│  [사용자 검색하여 매니저 추가...] 검색 인풋          │
│  ┌────────────────────────────────────┐          │
│  │  검색 결과 드롭다운                  │          │
│  │  김철수 (kim@email.com)  [지정]     │          │
│  │  이영희 (lee@email.com)  [지정]     │          │
│  └────────────────────────────────────┘          │
│                                                  │
│  ── 매니저 목록 (5명) ──────────────────────────── │
│                                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │  박매니저  010-1234-5678   2024-01-15 지정    │ │
│  │  소속 클럽: 마포테니스, 상암테니스              │ │
│  │                              [해제] btn-red  │ │
│  ├──────────────────────────────────────────────┤ │
│  │  최매니저  010-9876-5432   2024-02-20 지정    │ │
│  │  소속 클럽: 없음                              │ │
│  │                              [해제] btn-red  │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 5.3 클럽 관리 페이지

#### `/admin/clubs` — 내 클럽 목록

```
┌──────────────────────────────────────────────────┐
│  클럽 관리                           [클럽 생성] btn│
├──────────────────────────────────────────────────┤
│                                                  │
│  [검색...]                                       │
│                                                  │
│  ┌─ glass-card ──────────┐  ┌─ glass-card ──────┐│
│  │  마포테니스클럽         │  │  상암테니스클럽     ││
│  │  서울 마포구            │  │  서울 마포구        ││
│  │  회원 24명              │  │  회원 18명          ││
│  │  마포구테니스협회 소속    │  │  독립 클럽          ││
│  │  가입방식: APPROVAL     │  │  가입방식: OPEN     ││
│  │  [관리]                │  │  [관리]            ││
│  └───────────────────────┘  └───────────────────┘│
└──────────────────────────────────────────────────┘
```

#### `/admin/clubs/[id]` — 클럽 수정 + 회원 관리 (탭 구조)

```
┌──────────────────────────────────────────────────┐
│  ← 뒤로   마포테니스클럽                           │
├──────────────────────────────────────────────────┤
│  [클럽 정보]  [회원 관리]                ← 탭      │
├──────────────────────────────────────────────────┤
│                                                  │
│  === 회원 관리 탭 ===                             │
│                                                  │
│  [가입회원 초대]  [비가입회원 추가]     ← 2개 버튼   │
│                                                  │
│  ── 회원 목록 (24명) ──────────────────────────── │
│  [전체] [가입회원] [비가입회원]         ← 필터 탭   │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │ ■ 김철수  OWNER  가입회원                      ││
│  │   010-1234-5678 · 2020년 입문 · 레이팅 850    ││
│  ├──────────────────────────────────────────────┤│
│  │ □ 이영희  MEMBER  가입회원                     ││
│  │   010-9876-5432 · 2022년 입문 · 레이팅 720    ││
│  │                          [역할변경] [제거]    ││
│  ├──────────────────────────────────────────────┤│
│  │ □ 박신입  MEMBER  비가입회원                    ││
│  │   010-5555-1234 · 남성 · 1985-03             ││
│  │   2023년 입문 · 점수 없음                      ││
│  │                          [수정] [제거]        ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 5.4 비가입 회원 추가 모달

```
┌─ Modal (size="lg") ──────────────────────────────┐
│  비가입 회원 추가                              [X] │
├──────────────────────────────────────────────────┤
│  Modal.Body                                      │
│                                                  │
│  이름 *          [                            ]   │
│  생년월일        [          ] (YYYY-MM 형식)       │
│  성별            (●) 남성  (○) 여성                │
│  연락처          [                            ]   │
│  테니스 입문년도  [          ]                      │
│  점수/레이팅     [          ]                      │
│                                                  │
├──────────────────────────────────────────────────┤
│  Modal.Footer                                    │
│  [취소] btn-secondary        [등록] btn-primary   │
└──────────────────────────────────────────────────┘
```

### 5.5 회원 제거 플로우

```
1. [제거] 버튼 클릭
    ↓
2. ConfirmDialog: "김철수 회원을 제거하시겠습니까?"
    ↓ 확인
3. Modal: 제거 사유 입력
   ┌─ Modal (size="md") ───────────────────────┐
   │  회원 제거 사유                          [X]│
   ├───────────────────────────────────────────┤
   │  제거 사유 *                               │
   │  [                                      ] │
   │  (예: 장기 미활동, 본인 요청 등)             │
   ├───────────────────────────────────────────┤
   │  [취소]              [제거 확인] btn-error  │
   └───────────────────────────────────────────┘
    ↓ 확인
4. removeMember(memberId, reason) 호출
5. Toast("회원이 제거되었습니다")
```

### 5.6 프로필 수정 — 클럽 선택

```
기존 프로필 수정 페이지에 추가:

┌──────────────────────────────────────────────────┐
│  클럽 소속                                        │
│                                                  │
│  현재 클럽: 마포테니스클럽 (마포구테니스협회)        │
│             [탈퇴하기]                             │
│                                                  │
│  — 또는 —                                        │
│                                                  │
│  클럽 소속이 없는 경우:                             │
│  클럽 선택  [▼ 클럽을 검색하세요...           ]     │
│            ┌──────────────────────────────┐      │
│            │ 마포테니스클럽 (마포구, OPEN)  │      │
│            │ 상암테니스클럽 (마포구, APPROVAL)│     │
│            │ 강남테니스클럽 (강남구, OPEN)   │      │
│            └──────────────────────────────┘      │
│                                                  │
│  ※ 가입 방식에 따라 즉시 가입 또는 승인 대기        │
└──────────────────────────────────────────────────┘
```

### 5.7 공개 클럽 목록 — `/clubs`

```
┌──────────────────────────────────────────────────┐
│  테니스 클럽 찾기                                  │
├──────────────────────────────────────────────────┤
│  [클럽 검색...]     지역: [전체 ▼]  협회: [전체 ▼] │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ glass-card ──────────┐  ┌─ glass-card ──────┐│
│  │  마포테니스클럽         │  │  강남테니스클럽     ││
│  │  서울 마포구            │  │  서울 강남구        ││
│  │  마포구테니스협회        │  │  독립 클럽          ││
│  │  회원 24명 · APPROVAL   │  │  회원 30명 · OPEN  ││
│  │  [상세보기]            │  │  [가입하기]        ││
│  └───────────────────────┘  └───────────────────┘│
│                                                  │
│  ┌─ glass-card ──────────┐                       │
│  │  상암테니스클럽         │                       │
│  │  서울 마포구            │                       │
│  │  마포구테니스협회        │                       │
│  │  회원 18명 · INVITE_ONLY│                      │
│  │  [상세보기]            │                       │
│  └───────────────────────┘                       │
└──────────────────────────────────────────────────┘
```

### 5.8 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `AssociationForm` | `src/components/associations/AssociationForm.tsx` | 협회 생성/수정 폼 |
| `ManagerList` | `src/components/associations/ManagerList.tsx` | 매니저 목록 + 검색/지정/해제 |
| `UserSearchInput` | `src/components/associations/UserSearchInput.tsx` | 사용자 이름/이메일 검색 공통 |
| `ClubCard` | `src/components/clubs/ClubCard.tsx` | 클럽 카드 (목록용) |
| `ClubForm` | `src/components/clubs/ClubForm.tsx` | 클럽 생성/수정 폼 |
| `ClubMemberList` | `src/components/clubs/ClubMemberList.tsx` | 회원 목록 + 필터 + 관리 |
| `AddMemberModal` | `src/components/clubs/AddMemberModal.tsx` | 비가입 회원 추가 (Modal 사용) |
| `MemberInviteModal` | `src/components/clubs/MemberInviteModal.tsx` | 가입 회원 초대 (Modal + UserSearchInput) |
| `RemoveReasonModal` | `src/components/clubs/RemoveReasonModal.tsx` | 제거 사유 입력 (Modal 사용) |
| `ClubMemberRoleBadge` | `src/components/clubs/ClubMemberRoleBadge.tsx` | 역할 뱃지 (OWNER/ADMIN/MEMBER) |
| `ClubSelector` | `src/components/clubs/ClubSelector.tsx` | 프로필 수정용 클럽 검색/선택 드롭다운 |

---

## 6. Error Handling

### 6.1 Server Action 에러 패턴

```typescript
// 기존 프로젝트 패턴 유지: try-catch + 구체적 에러 메시지
export async function createClub(data: CreateClubInput) {
  try {
    // ... 로직
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: '클럽 생성에 실패했습니다' };
  }
}

// 클라이언트에서 처리
const result = await createClub(formData);
if (result?.error) {
  setAlertDialog({ isOpen: true, message: result.error, type: 'error' });
  return;
}
setToast({ isOpen: true, message: '클럽이 생성되었습니다', type: 'success' });
```

### 6.2 에러 시나리오

| 시나리오 | 에러 메시지 | UI 처리 |
|----------|-----------|---------|
| ADMIN이 2번째 협회 생성 시도 | "이미 협회를 보유하고 있습니다" | AlertDialog(error) |
| 권한 없는 사용자가 클럽 생성 | "MANAGER 이상 권한이 필요합니다" | AlertDialog(error) |
| 중복 클럽 가입 | "이미 가입된 클럽입니다" | AlertDialog(warning) |
| INVITE_ONLY 클럽에 직접 가입 | "이 클럽은 초대로만 가입할 수 있습니다" | AlertDialog(info) |
| OWNER 제거 시도 | "클럽 소유자는 제거할 수 없습니다" | AlertDialog(error) |
| 빈 사유로 회원 제거 | 클라이언트 폼 검증 | 인풋 에러 표시 |

---

## 7. Security Considerations

- [x] Server Actions에서 권한 이중 검증 (role 체크 + 소유권 체크)
- [x] Admin Client(Service Role Key)로 RLS 우회 — Server Action 내부에서만 사용
- [x] `validateId()` 입력 검증 (기존 패턴 재사용)
- [x] OWNER 제거 방지 (서버 사이드 검증)
- [x] 매니저 지정 시 role 변경은 반드시 Server Action 경유
- [x] 비가입 회원 정보는 개인정보 — 같은 클럽 회원만 조회 가능 (RLS)

---

## 8. Styling Guide

### 8.1 CSS 변수 사용 규칙

```css
/* 배경 */
background: var(--bg-primary);      /* 페이지 배경 */
background: var(--bg-secondary);    /* 카드/섹션 배경 */
background: var(--bg-card);         /* glass-card 배경 */

/* 텍스트 */
color: var(--text-primary);         /* 주요 텍스트 */
color: var(--text-secondary);       /* 보조 텍스트 */
color: var(--text-muted);           /* 비활성 텍스트 */

/* 강조/액센트 */
color: var(--accent-color);         /* 강조 색상 (다크: #ccff00, 라이트: #2d5a27) */
border-color: var(--border-accent); /* 강조 보더 */

/* 보더 */
border-color: var(--border-color);  /* 기본 보더 */
```

### 8.2 시맨틱 클래스 활용

```tsx
// 카드
<div className="glass-card rounded-xl p-5">

// 버튼
<button className="btn-primary btn-sm">생성</button>
<button className="btn-secondary btn-sm">취소</button>

// 상태 뱃지
<span className="badge-open">활성</span>
<span className="badge-closed">비활성</span>
<span className="badge-progress">대기중</span>

// 인풋 — Tailwind 레이아웃 + CSS 변수
<input className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none" />
```

### 8.3 새로 추가할 시맨틱 클래스 (globals.css)

```css
/* 역할 뱃지 */
.badge-role-owner {
  background-color: var(--accent-color);
  color: var(--bg-primary);
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
}

.badge-role-admin {
  background-color: var(--court-info);
  color: white;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
}

.badge-role-member {
  background-color: var(--bg-card-hover);
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
}

/* 가입/비가입 표시 */
.badge-registered {
  color: var(--accent-color);
  font-size: 0.75rem;
}

.badge-unregistered {
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* 인풋 공통 */
.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background-color: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  transition: border-color 0.2s ease;
}

.input-field:focus {
  border-color: var(--accent-color);
  outline: none;
}

.input-field::placeholder {
  color: var(--text-muted);
}
```

---

## 9. Implementation Order

### 9.1 Phase 1: DB + Server Actions (백엔드)

1. [ ] Supabase 마이그레이션: `associations`, `association_managers` 테이블
2. [ ] Supabase 마이그레이션: `clubs`, `club_members` 테이블 + ENUM 타입
3. [ ] RLS 정책 적용
4. [ ] 인덱스 생성
5. [ ] `src/lib/associations/actions.ts` — 협회 CRUD + 매니저 관리
6. [ ] `src/lib/clubs/actions.ts` — 클럽 CRUD + 회원 관리
7. [ ] TypeScript 타입 정의 (`types.ts`)

### 9.2 Phase 2: Admin UI (관리자)

8. [ ] AdminSidebar 메뉴 추가 (협회관리, 클럽관리)
9. [ ] `/admin/associations` — 내 협회 페이지
10. [ ] `/admin/associations/new` — 협회 생성 폼
11. [ ] `/admin/associations/[id]` — 협회 수정
12. [ ] `/admin/associations/[id]/managers` — 매니저 관리
13. [ ] `/admin/clubs` — 내 클럽 목록
14. [ ] `/admin/clubs/new` — 클럽 생성 폼
15. [ ] `/admin/clubs/[id]` — 클럽 수정 + 회원 관리 (탭)

### 9.3 Phase 3: 공개 페이지 + 프로필 연동

16. [ ] `/clubs` — 공개 클럽 목록 (검색, 필터)
17. [ ] `/clubs/[id]` — 클럽 상세 페이지
18. [ ] 프로필 수정 페이지에 `ClubSelector` 추가
19. [ ] `joinClubAsRegistered()` 연동 + profiles 하위 호환 업데이트

### 9.4 Phase 4: globals.css + 마무리

20. [ ] 새 시맨틱 CSS 클래스 추가 (`.badge-role-*`, `.input-field` 등)
21. [ ] 라이트/다크 모드 검증
22. [ ] TypeScript strict 에러 0개 확인
23. [ ] Build 성공 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-11 | Initial design — 전체 아키텍처, Server Actions, UI 레이아웃, 스타일링 가이드 | AI Assistant |
| 0.2 | 2026-02-11 | Association 엔티티에 협회장/사무장 연락처(president_phone/email, secretary_phone/email) 추가 | AI Assistant |
