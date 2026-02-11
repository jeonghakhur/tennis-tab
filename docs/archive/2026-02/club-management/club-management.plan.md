---
template: plan
version: 1.2
description: 협회/클럽 생성·관리 및 회원 관리 기능 계획서
variables:
  - feature: club-management
  - date: 2026-02-10
  - author: AI Assistant
  - project: tennis-tab
  - version: 0.2
---

# club-management Planning Document

> **Summary**: ADMIN이 협회를 생성하고 매니저를 지정하며, MANAGER가 클럽을 생성·관리하는 계층 구조 기능
>
> **Project**: tennis-tab
> **Version**: 0.2
> **Author**: AI Assistant
> **Date**: 2026-02-10
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

ADMIN이 협회(association)를 생성하고 해당 협회의 매니저를 지정하며, MANAGER가 소속 협회 아래에 클럽을 생성·관리하는 계층 구조를 제공한다. 클럽 정보(이름, 지역, 설명 등) 관리 및 클럽 회원 초대/승인/제거 기능을 포함한다. 현재 `profiles.club` 필드가 단순 문자열로만 존재하여 클럽 간 연결이나 회원 관리가 불가능한 문제를 해결한다.

**권한 계층:**
- **SUPER_ADMIN**: 전체 시스템 관리 (모든 협회/클럽 접근)
- **ADMIN**: 협회 1개 생성 가능 → 해당 협회에 매니저 지정
- **MANAGER (협회 소속)**: 소속 협회 아래 클럽 생성·관리
- **MANAGER (협회 미소속)**: 협회에 속하지 않는 독립 클럽 생성·관리
- **USER**: 클럽 가입/탈퇴, 클럽 정보 조회

### 1.2 Background

현재 시스템의 클럽 관련 한계:

- `profiles.club`이 문자열이라 같은 클럽인지 정확히 구분 불가 ("테니스A" vs "테니스 A")
- 클럽 단위 통계/조회 불가능
- 클럽 회원 목록을 볼 수 없음
- 대회 참가 시 클럽 소속 확인이 수동

협회-클럽 계층 구조를 도입하면:
- 협회 → 클럽 → 회원의 명확한 조직 체계
- ADMIN/MANAGER 역할에 따른 체계적 권한 분리
- 대회 엔트리에서 정확한 클럽/협회 소속 자동 연결
- 클럽 단위 대회 개최/참가 기반 마련

### 1.3 Related Documents

- 권한 체계: `src/lib/auth/roles.ts` — ADMIN이 협회 관리, MANAGER가 클럽 관리
- 프로필: `src/lib/supabase/types.ts` — `profiles.club`, `club_city`, `club_district`
- Admin 라우트: `src/app/admin/` — 클럽 관리 페이지 추가 예정

---

## 2. Scope

### 2.1 In Scope

- [ ] `associations` 테이블 생성 (협회 엔티티)
- [ ] `association_managers` 테이블 생성 (협회-매니저 관계)
- [ ] `clubs` 테이블 생성 (클럽 정보 엔티티, `association_id` nullable)
- [ ] `club_members` 테이블 생성 (클럽-회원 관계)
- [ ] 협회 CRUD (ADMIN 권한, 1인 1협회 제한)
- [ ] 협회 매니저 지정/해제 (해당 협회 ADMIN)
- [ ] 클럽 CRUD (MANAGER 권한 — 협회 소속 매니저는 해당 협회 아래, 미소속 매니저는 독립 클럽)
- [ ] 클럽 회원 관리 (초대, 승인, 탈퇴, 강제 제거)
- [ ] 클럽 회원 역할 (owner, admin, member)
- [ ] 클럽 상세 페이지 (공개 정보, 회원 목록)
- [ ] 협회/클럽 Admin 관리 페이지
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
| **협회 관리** | | | |
| FR-01 | ADMIN이 협회를 1개 생성할 수 있다 (1인 1협회 제한) | High | Pending |
| FR-02 | 협회 소유 ADMIN이 협회 정보(이름, 지역)를 수정할 수 있다 | High | Pending |
| FR-03 | 협회 소유 ADMIN이 해당 협회에 매니저를 지정할 수 있다 (USER → MANAGER 승격) | High | Pending |
| FR-04 | 협회 소유 ADMIN이 매니저를 해제할 수 있다 (MANAGER → USER 강등) | High | Pending |
| FR-05 | 협회 소유 ADMIN이 협회를 삭제할 수 있다 | Low | Pending |
| **클럽 관리** | | | |
| FR-06 | 협회 소속 MANAGER가 해당 협회 아래 클럽을 생성할 수 있다 | High | Pending |
| FR-07 | 협회 미소속 MANAGER가 독립 클럽(association_id = null)을 생성할 수 있다 | High | Pending |
| FR-08 | 클럽 생성자는 자동으로 owner 역할 부여 | High | Pending |
| FR-09 | owner/admin이 클럽 정보(이름, 지역, 설명)를 수정할 수 있다 | High | Pending |
| **클럽 회원 관리** | | | |
| FR-10 | owner/admin이 가입된 회원을 초대할 수 있다 (이메일/이름 검색) | High | Pending |
| FR-11 | 초대받은 사용자가 수락/거절할 수 있다 | High | Pending |
| FR-12 | owner/admin이 **비가입 회원을 직접 등록**할 수 있다 (이름, 생년월일, 성별, 연락처, 입문년도, 점수) | High | Pending |
| FR-12a | 홈페이지 가입 회원이 프로필 수정에서 클럽을 선택하면 **profiles 데이터로 club_members 자동 채움** (is_registered=true) | High | Pending |
| FR-12b | 비가입 회원이 나중에 홈페이지 가입 후 클럽 선택 시 기존 비가입 회원 데이터와 연결(claim) | Medium | Pending |
| FR-13 | owner/admin이 회원을 강제 탈퇴시킬 수 있다 | Medium | Pending |
| FR-14 | 회원이 자발적으로 클럽을 탈퇴할 수 있다 | Medium | Pending |
| FR-15 | owner가 다른 회원을 admin으로 승격/강등할 수 있다 | Medium | Pending |
| **클럽 가입/조회** | | | |
| FR-16 | 클럽 상세 페이지에서 공개 정보 및 회원 목록 조회 | High | Pending |
| FR-17 | 클럽 가입 방식 설정 (OPEN/APPROVAL/INVITE_ONLY) | High | Pending |
| FR-17a | OPEN: 가입 버튼 클릭 시 즉시 회원 등록 | High | Pending |
| FR-17b | APPROVAL: 가입 신청 → owner/admin 승인/거절 | High | Pending |
| FR-17c | INVITE_ONLY: 가입 버튼 비노출, 초대로만 가입 | High | Pending |
| FR-18 | 클럽 목록 페이지 (검색, 지역 필터, 협회별 필터) | Medium | Pending |
| FR-19 | 사용자 프로필에 소속 클럽 표시 (club_id 기반) | High | Pending |
| FR-20 | owner가 클럽을 삭제할 수 있다 | Low | Pending |
| **전체 관리** | | | |
| FR-21 | SUPER_ADMIN은 모든 협회/클럽을 관리할 수 있다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 클럽 목록/회원 목록 로딩 < 1초 | Lighthouse |
| Security | 권한 검증: ADMIN 협회 생성(1개 제한), MANAGER 클럽 생성, owner/admin만 관리 | Server Actions 검증 |
| Data Integrity | 기존 `profiles.club` → `club_id` 마이그레이션 무손실 | 마이그레이션 전후 검증 |
| UX | 모바일 반응형, 라이트/다크 모드 지원 | 디바이스 테스트 |
| Design | 현 프로젝트 디자인 톤앤매너 유지 (아래 디자인 가이드라인 참조) | 시각적 검토 |

### 3.3 Design Guidelines

- **톤앤매너**: 기존 페이지(대회 목록, 대진표 등)의 디자인 톤앤매너를 유지할 것
- **라이트/다크 모드**: `globals.css`에 정의된 CSS 변수(`--bg-primary`, `--text-primary`, `--accent-color` 등)를 사용하여 라이트/다크 모드에 대응할 것. Tailwind의 `dark:` prefix 남용 금지
- **시맨틱 CSS 클래스**: 반복되는 시각적 패턴은 `globals.css`의 기존 클래스(`.glass-card`, `.btn-primary`, `.btn-secondary` 등)를 재사용하고, 필요 시 새 시맨틱 클래스를 추가
- **Tailwind 사용 범위**: 레이아웃/간격 유틸리티(`flex`, `grid`, `gap-*`, `p-*`, `rounded-*`)에만 사용
- **공통 컴포넌트 재사용** (`CLAUDE.md` 정의): 모달은 반드시 `Modal`(`/src/components/common/Modal.tsx`), 알림은 `AlertDialog`/`ConfirmDialog`/`Toast`, 로딩은 `LoadingOverlay` 사용. 자체 모달/다이얼로그 생성 금지
- **스킬 문서 참고**: 디자인 구현 시 `/phase-5-design-system`, `/phase-3-mockup` 스킬 문서를 참고하여 컴포넌트 일관성 확보

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] DB 마이그레이션 완료 (`associations`, `association_managers`, `clubs`, `club_members` 테이블)
- [ ] RLS 정책 적용 (읽기: 공개, 쓰기: 권한별)
- [ ] 협회 CRUD + 매니저 지정 Server Actions 구현
- [ ] 클럽 CRUD Server Actions 구현 (협회 소속/독립 분기)
- [ ] 클럽 회원 관리 Server Actions 구현
- [ ] 협회/클럽 상세 페이지 구현
- [ ] Admin 협회/클럽 관리 UI 구현
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
| ADMIN이 협회 삭제 시 소속 매니저/클럽 처리 | Medium | Low | 삭제 전 확인 다이얼로그, 소속 클럽은 독립 클럽으로 전환(association_id = null) |
| 매니저 해제 시 해당 매니저가 만든 클럽 처리 | Medium | Low | 클럽은 유지, 클럽 owner 역할은 그대로 (매니저 역할만 해제) |
| 비가입 회원 claim 시 동명이인 | Medium | Medium | 이름 + 연락처 + 클럽 조합으로 매칭 후보 표시, 최종 확인은 owner/admin 승인 |
| 가입 회원 profiles 변경 시 club_members 동기화 | Medium | Medium | 프로필 수정 시 소속 클럽의 club_members도 함께 업데이트 (이름, 연락처 등) |

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
| 협회-매니저 관계 | profiles.role로 관리 / 별도 association_managers 테이블 | association_managers 테이블 | 어떤 협회에 속한 매니저인지 명시적 연결 필요 |
| ADMIN 협회 제한 | 제한 없음 / 1개 제한 | 1개 제한 | ADMIN 1인당 1협회로 책임 명확화 |
| 클럽-협회 관계 | 필수 소속 / nullable (독립 클럽 허용) | nullable | 협회 미소속 매니저도 독립 클럽 생성 가능 |
| 비가입 회원 처리 | 별도 guest_members 테이블 / club_members에 통합 | club_members에 통합 (is_registered 불리언) | 테이블 하나로 통합, 가입 회원은 profiles→자동 채움, 비가입은 매니저 직접 입력 |
| 클럽-회원 관계 | profiles.club_id FK / 별도 club_members 테이블 | club_members 테이블 | 다중 소속, 역할 관리, 초대 상태 관리 필요 |
| 클럽 내 역할 | Enum(owner/admin/member) / 별도 테이블 | Enum 컬럼 | 역할이 3개로 단순, 별도 테이블 불필요 |
| 초대 방식 | 이메일 초대 / 앱 내 검색 초대 / 초대 코드 | 앱 내 검색 초대 | 기존 회원 대상, 이메일 인프라 불필요 |
| 기존 club 필드 처리 | 즉시 제거 / nullable 유지 / 읽기 전용 | nullable 유지 (하위 호환) | 마이그레이션 기간 동안 기존 기능 유지 |
| 라우트 구조 | /clubs / /admin/clubs | 둘 다 + /admin/associations | 공개 조회와 관리 분리, 협회 관리 추가 |

### 6.3 Clean Architecture Approach

```
Selected Level: Dynamic

Folder Structure:
┌─────────────────────────────────────────────────────┐
│ src/app/clubs/                                      │ ← 공개 클럽 페이지
│   ├── page.tsx                                      │   클럽 목록 (검색, 필터)
│   └── [id]/page.tsx                                 │   클럽 상세 (정보, 회원 목록)
│ src/app/admin/associations/                         │ ← 협회 관리 (ADMIN)
│   ├── page.tsx                                      │   내 협회 관리
│   ├── new/page.tsx                                  │   협회 생성 (1개 제한)
│   └── [id]/                                         │
│       ├── page.tsx                                  │   협회 수정
│       └── managers/page.tsx                         │   매니저 지정/해제
│ src/app/admin/clubs/                                │ ← 클럽 관리 (MANAGER)
│   ├── page.tsx                                      │   내 클럽 목록
│   ├── new/page.tsx                                  │   클럽 생성
│   └── [id]/page.tsx                                 │   클럽 수정, 회원 관리
│ src/components/associations/                        │ ← 협회 컴포넌트
│   ├── AssociationForm.tsx                           │   협회 생성/수정 폼
│   └── ManagerList.tsx                               │   매니저 목록 + 지정/해제
│ src/components/clubs/                               │ ← 클럽 컴포넌트
│   ├── ClubCard.tsx                                  │   클럽 카드 UI
│   ├── ClubForm.tsx                                  │   생성/수정 폼
│   ├── MemberList.tsx                                │   회원 목록
│   ├── MemberInviteModal.tsx                         │   회원 초대 모달
│   └── ClubMemberRoleBadge.tsx                       │   역할 뱃지
│ src/lib/associations/                               │ ← 협회 Server Actions
│   └── actions.ts                                    │   CRUD + 매니저 관리
│ src/lib/clubs/                                      │ ← 클럽 Server Actions
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
| **Naming** | exists | `ClubMemberRole`, `AssociationManager` enum/타입 네이밍 | High |
| **Folder structure** | exists | `src/lib/associations/`, `src/lib/clubs/`, `src/components/associations/`, `src/components/clubs/` 신규 | High |
| **Auth pattern** | exists | `checkAssociationAdminAuth()`, `checkClubManagementAuth()` 패턴 추가 | High |
| **RLS** | exists | associations/association_managers/clubs/club_members RLS 정책 정의 | High |

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
  description TEXT,                -- 협회 소개
  president_name TEXT,             -- 협회장 이름
  president_phone TEXT,            -- 협회장 연락처
  president_email TEXT,            -- 협회장 이메일
  secretary_name TEXT,             -- 사무장 이름
  secretary_phone TEXT,            -- 사무장 연락처
  secretary_email TEXT,            -- 사무장 이메일
  created_by UUID NOT NULL REFERENCES profiles(id),  -- 생성한 ADMIN
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(created_by)               -- ADMIN 1인당 1협회 제한
);

-- 협회 매니저 테이블 (ADMIN이 지정한 매니저 목록)
CREATE TABLE association_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),  -- 지정한 ADMIN
  assigned_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(association_id, user_id)  -- 한 협회에 같은 매니저 중복 방지
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

-- 성별
CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE');

-- 클럽 회원 테이블
-- is_registered: 홈페이지 가입 회원 여부
-- 가입 회원이 프로필에서 클럽 선택 시 profiles 데이터로 자동 채움
-- 비가입 회원은 매니저가 직접 입력
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- 가입 회원만 연결
  is_registered BOOLEAN NOT NULL DEFAULT false,             -- 홈페이지 가입 회원 여부

  -- 회원 정보 (가입 회원: profiles에서 자동 채움, 비가입 회원: 매니저 직접 입력)
  name TEXT NOT NULL,                -- 이름 (profiles.name)
  birth_date TEXT,                   -- 생년월일 (YYYY-MM 또는 YYYY-MM-DD) — profiles에 없는 필드
  gender gender_type,                -- 성별 — profiles에 없는 필드
  phone TEXT,                        -- 연락처 (profiles.phone)
  start_year TEXT,                   -- 테니스 입문 년도 (profiles.start_year — TEXT 타입 맞춤)
  rating NUMERIC,                    -- 점수/레이팅 (profiles.rating — 이름·타입 통일)

  role club_member_role NOT NULL DEFAULT 'MEMBER',
  status club_member_status NOT NULL DEFAULT 'ACTIVE',
  status_reason TEXT,                -- 상태 변경 사유 (REMOVED 시 제거 사유 등)
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 가입 회원: 한 클럽에 같은 사용자 중복 방지
  UNIQUE(club_id, user_id)
);

-- 인덱스
CREATE INDEX idx_associations_created_by ON associations(created_by);
CREATE INDEX idx_association_managers_association_id ON association_managers(association_id);
CREATE INDEX idx_association_managers_user_id ON association_managers(user_id);
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
// src/lib/associations/actions.ts — 협회 관리

// 협회 생성 (ADMIN, 1인 1협회 제한)
export async function createAssociation(data: CreateAssociationInput)

// 협회 정보 수정 (해당 협회 ADMIN)
export async function updateAssociation(associationId: string, data: UpdateAssociationInput)

// 협회 삭제 (해당 협회 ADMIN)
export async function deleteAssociation(associationId: string)

// 내 협회 조회 (ADMIN)
export async function getMyAssociation()

// 매니저 지정 (해당 협회 ADMIN — 대상 사용자를 MANAGER로 승격)
export async function assignManager(associationId: string, userId: string)

// 매니저 해제 (해당 협회 ADMIN — MANAGER → USER 강등)
export async function removeManager(associationId: string, userId: string)

// 협회 매니저 목록 조회
export async function getAssociationManagers(associationId: string)


// src/lib/clubs/actions.ts — 클럽 관리

// 클럽 생성 (MANAGER — 협회 소속이면 해당 협회 아래, 미소속이면 독립 클럽)
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

// 가입 회원 클럽 가입 (프로필에서 클럽 선택 → profiles 데이터로 club_members 자동 생성)
export async function joinClubAsRegistered(clubId: string)

// 비가입 회원 직접 등록 (owner/admin — 이름, 생년월일, 성별, 연락처, 입문년도, 점수)
export async function addUnregisteredMember(clubId: string, data: UnregisteredMemberInput)

// 비가입 회원 → 가입 회원 연결 (홈페이지 가입 후 클럽 선택 시 기존 데이터 claim)
export async function claimMembership(memberId: string)

// 회원 초대 (owner/admin — 가입된 사용자 대상)
export async function inviteMember(clubId: string, userId: string)

// 초대 수락/거절 (초대받은 본인)
export async function respondInvitation(memberId: string, accept: boolean)

// 회원 역할 변경 (owner만)
export async function updateMemberRole(memberId: string, role: ClubMemberRole)

// 회원 제거 (owner/admin — 사유 필수 입력)
export async function removeMember(memberId: string, reason: string)

// 자발적 탈퇴 (본인)
export async function leaveClub(clubId: string)

// 내 클럽 목록
export async function getMyClubs()
```

### 8.3 RLS 정책

```sql
-- associations: 읽기는 공개, 쓰기는 생성한 ADMIN만
ALTER TABLE associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "associations_select" ON associations FOR SELECT USING (true);
CREATE POLICY "associations_insert" ON associations FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "associations_update" ON associations FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "associations_delete" ON associations FOR DELETE
  USING (auth.uid() = created_by);

-- association_managers: 읽기는 공개, 쓰기는 해당 협회 ADMIN만
ALTER TABLE association_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "association_managers_select" ON association_managers FOR SELECT
  USING (true);
CREATE POLICY "association_managers_insert" ON association_managers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM associations
      WHERE id = association_id AND created_by = auth.uid()
    )
  );
CREATE POLICY "association_managers_delete" ON association_managers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM associations
      WHERE id = association_id AND created_by = auth.uid()
    )
  );

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
// === 협회 컴포넌트 ===

// 협회 폼 — 생성/수정 (ADMIN 전용, 1개 제한)
<AssociationForm association={existing} onSubmit={handleSubmit} />

// 매니저 목록 — 사용자 검색 + 지정/해제
<ManagerList managers={managers} onAssign={handleAssign} onRemove={handleRemove} />

// === 클럽 컴포넌트 ===

// 클럽 카드 — 목록에서 사용 (협회명 표시 또는 '독립 클럽')
<ClubCard club={club} memberCount={count} />

// 클럽 폼 — 생성/수정 공통 (협회 소속 매니저면 association_id 자동 설정)
<ClubForm club={existingClub} associationId={myAssociationId} onSubmit={handleSubmit} />

// 회원 목록 — 역할 뱃지 + 관리 버튼
<MemberList members={members} currentUserRole={myRole} onAction={handleAction} />

// 회원 초대 모달 — 사용자 검색 + 초대
<MemberInviteModal clubId={id} isOpen={open} onClose={close} onInvite={invite} />
```

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`club-management.design.md`)
   - 협회/클럽 상세 UI 와이어프레임
   - 협회 매니저 지정/해제 플로우
   - 클럽 생성 시 협회 소속/독립 분기 로직
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
| 0.2 | 2026-02-11 | 권한 계층 개편: ADMIN→협회 생성(1개 제한)→매니저 지정, MANAGER→클럽 생성(협회 소속/독립), associations·association_managers 테이블 추가 | AI Assistant |
| 0.3 | 2026-02-11 | club_members 재설계: is_registered 불리언, 회원 상세 필드(이름/생년월일/성별/연락처/입문년도/점수), 가입 회원은 profiles 자동 채움 | AI Assistant |
| 0.4 | 2026-02-11 | associations 테이블에 협회장/사무장 연락처(president_phone/email, secretary_phone/email) 추가 | AI Assistant |
