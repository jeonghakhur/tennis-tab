---
template: plan
version: 1.2
description: 클럽 생성/관리 및 클럽 회원 관리 기능 계획서
variables:
  - feature: club-management
  - date: 2026-02-10
  - author: AI Assistant
  - project: tennis-tab
  - version: 0.1
---

# club-management Planning Document

> **Summary**: MANAGER 이상 사용자가 클럽을 생성하고, 클럽 정보 및 회원을 관리할 수 있는 기능
>
> **Project**: tennis-tab
> **Version**: 0.1
> **Author**: AI Assistant
> **Date**: 2026-02-10
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

MANAGER 이상 권한의 사용자가 테니스 클럽을 생성하여 클럽 정보(이름, 지역, 설명 등)를 관리하고, 클럽 회원을 초대/승인/제거할 수 있는 기능을 제공한다. 현재 `profiles.club` 필드가 단순 문자열로만 존재하여 클럽 간 연결이나 회원 관리가 불가능한 문제를 해결한다.

### 1.2 Background

현재 시스템의 클럽 관련 한계:

- `profiles.club`이 문자열이라 같은 클럽인지 정확히 구분 불가 ("테니스A" vs "테니스 A")
- 클럽 단위 통계/조회 불가능
- 클럽 회원 목록을 볼 수 없음
- 대회 참가 시 클럽 소속 확인이 수동

클럽 엔티티를 정규화하면:
- 클럽별 회원 관리 및 통계 제공
- 대회 엔트리에서 정확한 클럽 소속 자동 연결
- 클럽 단위 대회 개최/참가 기반 마련

### 1.3 Related Documents

- 권한 체계: `src/lib/auth/roles.ts` — MANAGER 이상이 클럽 관리
- 프로필: `src/lib/supabase/types.ts` — `profiles.club`, `club_city`, `club_district`
- Admin 라우트: `src/app/admin/` — 클럽 관리 페이지 추가 예정

---

## 2. Scope

### 2.1 In Scope

- [ ] `clubs` 테이블 생성 (클럽 정보 엔티티)
- [ ] `club_members` 테이블 생성 (클럽-회원 관계)
- [ ] 클럽 CRUD (MANAGER+ 권한)
- [ ] 클럽 회원 관리 (초대, 승인, 탈퇴, 강제 제거)
- [ ] 클럽 회원 역할 (owner, admin, member)
- [ ] 클럽 상세 페이지 (공개 정보, 회원 목록)
- [ ] Admin 클럽 관리 페이지
- [ ] 기존 `profiles.club` 문자열 → `club_id` FK 마이그레이션 전략

### 2.2 Out of Scope

- 클럽 간 대항전 기능 (v2)
- 클럽 게시판/채팅 (v2)
- 클럽별 대회 통계 대시보드 (v2)
- 클럽 로고/배너 이미지 업로드 (v2에서 검토)
- 회비 관리 기능

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | MANAGER+ 사용자가 클럽을 생성할 수 있다 | High | Pending |
| FR-02 | 클럽 생성자는 자동으로 owner 역할 부여 | High | Pending |
| FR-03 | owner/admin이 클럽 정보(이름, 지역, 설명)를 수정할 수 있다 | High | Pending |
| FR-04 | owner/admin이 회원을 초대할 수 있다 (이메일/이름 검색) | High | Pending |
| FR-05 | 초대받은 사용자가 수락/거절할 수 있다 | High | Pending |
| FR-06 | owner/admin이 회원을 강제 탈퇴시킬 수 있다 | Medium | Pending |
| FR-07 | 회원이 자발적으로 클럽을 탈퇴할 수 있다 | Medium | Pending |
| FR-08 | owner가 다른 회원을 admin으로 승격/강등할 수 있다 | Medium | Pending |
| FR-09 | 클럽 상세 페이지에서 공개 정보 및 회원 목록 조회 | High | Pending |
| FR-10 | 클럽 가입 방식 설정 (OPEN/APPROVAL/INVITE_ONLY) | High | Pending |
| FR-10a | OPEN: 가입 버튼 클릭 시 즉시 회원 등록 | High | Pending |
| FR-10b | APPROVAL: 가입 신청 → owner/admin 승인/거절 | High | Pending |
| FR-10c | INVITE_ONLY: 가입 버튼 비노출, 초대로만 가입 | High | Pending |
| FR-11 | 클럽 목록 페이지 (검색, 지역 필터) | Medium | Pending |
| FR-12 | 사용자 프로필에 소속 클럽 표시 (club_id 기반) | High | Pending |
| FR-13 | owner가 클럽을 삭제할 수 있다 | Low | Pending |
| FR-14 | SUPER_ADMIN은 모든 클럽을 관리할 수 있다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 클럽 목록/회원 목록 로딩 < 1초 | Lighthouse |
| Security | 권한 검증: MANAGER+ 클럽 생성, owner/admin만 관리 | Server Actions 검증 |
| Data Integrity | 기존 `profiles.club` → `club_id` 마이그레이션 무손실 | 마이그레이션 전후 검증 |
| UX | 모바일 반응형, 다크모드 지원 | 디바이스 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] DB 마이그레이션 완료 (`clubs`, `club_members` 테이블)
- [ ] RLS 정책 적용 (읽기: 공개, 쓰기: 권한별)
- [ ] 클럽 CRUD Server Actions 구현
- [ ] 클럽 회원 관리 Server Actions 구현
- [ ] 클럽 상세 페이지 구현
- [ ] Admin 클럽 관리 UI 구현
- [ ] 기존 `profiles.club` 호환성 유지
- [ ] TypeScript strict 에러 0개
- [ ] Build 성공

### 4.2 Quality Criteria

- [ ] TypeScript strict 모드 에러 0개
- [ ] ESLint 에러 0개
- [ ] Build 성공
- [ ] 권한 검증 시나리오 테스트 통과

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 기존 `profiles.club` 데이터 마이그레이션 복잡도 | Medium | Medium | 단계적 마이그레이션: 1단계에서 `club_id` nullable 추가, 2단계에서 기존 데이터 연결 |
| 한 사용자가 여러 클럽 소속 시 대회 엔트리 클럽 선택 | Medium | Medium | `club_members`로 다중 소속 허용, 대회 참가 시 소속 클럽 선택 UI 제공 |
| 클럽 owner가 탈퇴/비활성화되는 경우 | Low | Low | owner 이전 기능 또는 SUPER_ADMIN 개입 |
| 대량 회원 초대 시 성능 | Low | Low | 배치 초대 API, 페이지네이션 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend | O |
| **Enterprise** | Strict layer separation, microservices | High-traffic systems | |

**선택 근거**: 기존 프로젝트(Next.js + Supabase) Dynamic 레벨 유지.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 클럽-회원 관계 | profiles.club_id FK / 별도 club_members 테이블 | club_members 테이블 | 다중 소속, 역할 관리, 초대 상태 관리 필요 |
| 클럽 내 역할 | Enum(owner/admin/member) / 별도 테이블 | Enum 컬럼 | 역할이 3개로 단순, 별도 테이블 불필요 |
| 초대 방식 | 이메일 초대 / 앱 내 검색 초대 / 초대 코드 | 앱 내 검색 초대 | 기존 회원 대상, 이메일 인프라 불필요 |
| 기존 club 필드 처리 | 즉시 제거 / nullable 유지 / 읽기 전용 | nullable 유지 (하위 호환) | 마이그레이션 기간 동안 기존 기능 유지 |
| 라우트 구조 | /clubs / /admin/clubs | 둘 다 | 공개 조회(/clubs)와 관리(/admin/clubs) 분리 |

### 6.3 Clean Architecture Approach

```
Selected Level: Dynamic

Folder Structure:
┌─────────────────────────────────────────────────────┐
│ src/app/clubs/                                      │ ← 공개 클럽 페이지
│   ├── page.tsx                                      │   클럽 목록 (검색, 필터)
│   └── [id]/page.tsx                                 │   클럽 상세 (정보, 회원 목록)
│ src/app/admin/clubs/                                │ ← 클럽 관리 (MANAGER+)
│   ├── page.tsx                                      │   내 클럽 목록
│   ├── new/page.tsx                                  │   클럽 생성
│   └── [id]/page.tsx                                 │   클럽 수정, 회원 관리
│ src/components/clubs/                               │ ← 클럽 컴포넌트
│   ├── ClubCard.tsx                                  │   클럽 카드 UI
│   ├── ClubForm.tsx                                  │   생성/수정 폼
│   ├── MemberList.tsx                                │   회원 목록
│   ├── MemberInviteModal.tsx                         │   회원 초대 모달
│   └── ClubMemberRoleBadge.tsx                       │   역할 뱃지
│ src/lib/clubs/                                      │ ← Server Actions
│   └── actions.ts                                    │   CRUD + 회원 관리
└─────────────────────────────────────────────────────┘
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] TypeScript strict mode
- [x] Modal/AlertDialog/Toast 가이드
- [x] Server Actions 패턴 (`checkBracketManagementAuth()` 참고)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | exists | `ClubMemberRole` enum 네이밍 | High |
| **Folder structure** | exists | `src/lib/clubs/`, `src/components/clubs/` 신규 | High |
| **Auth pattern** | exists | `checkClubManagementAuth()` 패턴 추가 | High |
| **RLS** | exists | clubs/club_members RLS 정책 정의 | High |

### 7.3 Environment Variables Needed

기존 환경변수 사용 (신규 추가 불필요)

---

## 8. Technical Design Preview

### 8.1 Database Schema

```sql
-- 테니스 협회 테이블
CREATE TABLE associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,       -- '마포구테니스협회', '서초구테니스협회'
  region TEXT,                     -- '서울특별시'
  district TEXT,                   -- '마포구'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 클럽 가입 방식
CREATE TYPE club_join_type AS ENUM ('OPEN', 'APPROVAL', 'INVITE_ONLY');
-- OPEN: 누구나 즉시 가입
-- APPROVAL: 가입 신청 후 owner/admin 승인 필요
-- INVITE_ONLY: owner/admin이 초대한 사용자만 가입

-- 클럽 역할
CREATE TYPE club_member_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- 클럽 멤버 상태
CREATE TYPE club_member_status AS ENUM ('PENDING', 'INVITED', 'ACTIVE', 'LEFT', 'REMOVED');
-- PENDING: APPROVAL 모드에서 가입 신청 상태

-- 클럽 테이블
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  city TEXT,                  -- 시/도
  district TEXT,              -- 구/군
  address TEXT,               -- 상세 주소 (코트 위치 등)
  contact_phone TEXT,         -- 연락처
  contact_email TEXT,         -- 이메일
  join_type club_join_type NOT NULL DEFAULT 'APPROVAL',  -- 가입 방식
  association_id UUID REFERENCES associations(id),      -- 소속 협회 (null = 미소속)
  max_members INT,            -- 최대 회원 수 (null = 무제한)
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 클럽 회원 테이블
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role club_member_role NOT NULL DEFAULT 'MEMBER',
  status club_member_status NOT NULL DEFAULT 'INVITED',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(club_id, user_id)   -- 한 클럽에 같은 사용자 중복 방지
);

-- 인덱스
CREATE INDEX idx_clubs_city_district ON clubs(city, district);
CREATE INDEX idx_clubs_created_by ON clubs(created_by);
CREATE INDEX idx_clubs_association_id ON clubs(association_id);
CREATE INDEX idx_club_members_club_id ON club_members(club_id);
CREATE INDEX idx_club_members_user_id ON club_members(user_id);
CREATE INDEX idx_club_members_status ON club_members(status);

-- profiles 테이블에 primary_club_id 추가 (선택적)
-- ALTER TABLE profiles ADD COLUMN primary_club_id UUID REFERENCES clubs(id);
```

### 8.2 Server Actions 설계

```typescript
// src/lib/clubs/actions.ts

// 클럽 생성 (MANAGER+)
export async function createClub(data: CreateClubInput)

// 클럽 정보 수정 (owner/admin)
export async function updateClub(clubId: string, data: UpdateClubInput)

// 클럽 삭제 (owner만)
export async function deleteClub(clubId: string)

// 클럽 목록 조회 (공개)
export async function getClubs(filters?: ClubFilters)

// 클럽 상세 조회 (공개)
export async function getClub(clubId: string)

// 클럽 가입 신청 (OPEN: 즉시 가입, APPROVAL: 승인 대기)
export async function joinClub(clubId: string)

// 가입 신청 승인/거절 (owner/admin — APPROVAL 모드)
export async function respondJoinRequest(memberId: string, approve: boolean)

// 회원 초대 (owner/admin)
export async function inviteMember(clubId: string, userId: string)

// 초대 수락/거절 (초대받은 본인)
export async function respondInvitation(memberId: string, accept: boolean)

// 회원 역할 변경 (owner만)
export async function updateMemberRole(memberId: string, role: ClubMemberRole)

// 회원 제거 (owner/admin)
export async function removeMember(memberId: string)

// 자발적 탈퇴 (본인)
export async function leaveClub(clubId: string)

// 내 클럽 목록
export async function getMyClubs()
```

### 8.3 RLS 정책

```sql
-- clubs: 읽기는 공개, 쓰기는 owner/admin
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clubs_select" ON clubs FOR SELECT USING (true);
CREATE POLICY "clubs_insert" ON clubs FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "clubs_update" ON clubs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = clubs.id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND status = 'ACTIVE'
    )
  );

-- club_members: 같은 클럽 회원은 조회 가능
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_members_select" ON club_members FOR SELECT
  USING (true);  -- 공개 (클럽 상세에서 회원 목록 표시)
```

### 8.4 UI 컴포넌트 구조

```typescript
// 클럽 카드 — 목록에서 사용
<ClubCard club={club} memberCount={count} />

// 클럽 폼 — 생성/수정 공통
<ClubForm club={existingClub} onSubmit={handleSubmit} />

// 회원 목록 — 역할 뱃지 + 관리 버튼
<MemberList members={members} currentUserRole={myRole} onAction={handleAction} />

// 회원 초대 모달 — 사용자 검색 + 초대
<MemberInviteModal clubId={id} isOpen={open} onClose={close} onInvite={invite} />
```

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`club-management.design.md`)
   - 상세 UI 와이어프레임
   - Server Actions 상세 구현 설계
   - 마이그레이션 전략 상세화
   - `profiles.club` → `club_id` 데이터 이관 방안
2. [ ] Team review and approval
3. [ ] Start implementation (PDCA Do phase)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-10 | Initial draft | AI Assistant |
