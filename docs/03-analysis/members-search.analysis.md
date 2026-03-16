# 클럽 전체 회원 통합 검색 Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: tennis-tab
> **Analyst**: Claude (gap-detector)
> **Date**: 2026-03-16
> **Design Doc**: [members-search.design.md](../02-design/features/members-search.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

설계 문서(members-search.design.md)와 실제 구현 코드 간의 일치도를 검증한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/members-search.design.md`
- **Implementation Files**:
  - `src/lib/clubs/types.ts`
  - `src/lib/clubs/actions.ts`
  - `src/components/clubs/AllMembersSearch.tsx`
  - `src/app/admin/clubs/members/page.tsx`
  - `src/app/admin/clubs/page.tsx`
  - `src/components/admin/AdminSidebar.tsx`
- **Analysis Date**: 2026-03-16

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 타입 정의 (Section 2)

| 설계 항목 | 구현 상태 | Status | Notes |
|-----------|----------|--------|-------|
| `MemberWithClub` 타입 정의 | types.ts:96-99 | ✅ Match | `ClubMember & { club_name: string }` 동일 |
| JSDoc 주석 | types.ts:96 | ✅ Match | `/** 전체 회원 검색 결과 — ClubMember + 소속 클럽명 */` 동일 |

### 2.2 Server Action (Section 3)

| 설계 항목 | 구현 상태 | Status | Notes |
|-----------|----------|--------|-------|
| `MemberWithClub` import 추가 | actions.ts:27 | ✅ Match | |
| `getAllClubMembers()` 함수 시그니처 | actions.ts:1498 | ✅ Match | `Promise<{ data: MemberWithClub[]; error?: string }>` |
| `checkManagerAuth()` 권한 검증 | actions.ts:1502 | ✅ Match | |
| ADMIN 이상: 전체 회원 조회 | actions.ts:1506 | ✅ Match | `hasMinimumRole(user.role, 'ADMIN')` |
| MANAGER: 관리 클럽만 조회 | actions.ts:1511-1520 | ✅ Match | OWNER/ADMIN/MATCH_DIRECTOR 역할 필터 |
| 빈 클럽 목록 시 조기 반환 | actions.ts:1520 | ✅ Match | `return { data: [] }` |
| club_members + clubs JOIN | actions.ts:1524-1529 | ✅ Match | `.select('*, clubs:club_id ( name )')` |
| REMOVED/LEFT 상태 제외 | actions.ts:1527 | ✅ Match | `.not('status', 'in', '("REMOVED","LEFT")')` |
| 정렬: club_id, name | actions.ts:1528-1529 | ✅ Match | |
| 결과 매핑 (club_name 추출) | actions.ts:1539-1542 | ✅ Match | `row.clubs?.name ?? '알 수 없는 클럽'` |
| 변수명 `members` → `result` | actions.ts:1539 | ✅ Changed | 설계: `members`, 구현: `result` (기능 동일, Low) |

### 2.3 Server Component 페이지 (Section 4)

| 설계 항목 | 구현 상태 | Status | Notes |
|-----------|----------|--------|-------|
| 파일 경로 | `src/app/admin/clubs/members/page.tsx` | ✅ Match | |
| 인증 체크 (supabase.auth.getUser) | page.tsx:17 | ✅ Match | |
| MANAGER 이상 권한 체크 | page.tsx:26 | ✅ Match | |
| `getAllClubMembers()` 호출 | page.tsx:28 | ✅ Match | |
| 뒤로가기 링크 (`/admin/clubs`) | page.tsx:33-36 | ✅ Match | |
| 제목 "전체 회원 검색" | page.tsx:40 | ✅ Match | |
| 총 N명 표시 | page.tsx:44 | ✅ Match | |
| `AllMembersSearch` 컴포넌트 사용 | page.tsx:49 | ✅ Match | |
| `searchParams.q` 전달 | page.tsx:14,49 | ✅ Match | |
| `Props` 인터페이스 (`searchParams: Promise<{ q?: string }>`) | page.tsx:9-11 | ✅ Match | |

### 2.4 클라이언트 컴포넌트 (Section 5)

| 설계 항목 | 구현 상태 | Status | Notes |
|-----------|----------|--------|-------|
| 파일 경로 | `src/components/clubs/AllMembersSearch.tsx` | ✅ Match | |
| `'use client'` 디렉티브 | AllMembersSearch.tsx:1 | ✅ Match | |
| `ROLE_BADGE` config 객체 | AllMembersSearch.tsx:12-19 | ✅ Match | 6개 역할 모두 동일 |
| `GENDER_LABEL` config 객체 | AllMembersSearch.tsx:21 | ✅ Match | |
| `Props` 인터페이스 | AllMembersSearch.tsx:23-26 | ✅ Match | |
| 초성 검색 (`matchesKoreanSearch`) | AllMembersSearch.tsx:35-36 | ✅ Match | |
| 전화번호 검색 | AllMembersSearch.tsx:37 | ✅ Match | |
| URL ?q= 디바운스 300ms | AllMembersSearch.tsx:44-48 | ✅ Match | |
| 검색 input + aria-label | AllMembersSearch.tsx:57-63 | ✅ Match | `aria-label="회원 검색"` |
| 결과 수 표시 (조건부) | AllMembersSearch.tsx:67-70 | ✅ Match | |
| 빈 결과 메시지 | AllMembersSearch.tsx:74-79 | ✅ Match | |
| 회원 카드: 이름 + 역할 Badge | AllMembersSearch.tsx:90-94 | ✅ Match | |
| 가입/비가입 회원 구분 | AllMembersSearch.tsx:95-97 | ✅ Match | |
| 소속 클럽명 표시 | AllMembersSearch.tsx:100 | ✅ Match | |
| 상세정보 (전화, 성별, 생년, 레이팅) | AllMembersSearch.tsx:102-107 | ✅ Match | |
| Link → `/admin/clubs/[club_id]` | AllMembersSearch.tsx:85 | ✅ Match | |
| ChevronRight 아이콘 | AllMembersSearch.tsx:109 | ✅ Match | |
| ROLE_BADGE variant 타입 | AllMembersSearch.tsx:12 | ✅ Changed | 설계: inline union, 구현: `BadgeVariant` import (더 나은 패턴) |
| ChevronRight import | AllMembersSearch.tsx:6 | ✅ Match | 설계에서 별도 노트로 언급, 구현에서 올바르게 포함 |

### 2.5 기존 파일 수정 (Section 6)

| 설계 항목 | 구현 상태 | Status | Notes |
|-----------|----------|--------|-------|
| `Users` icon import 추가 | page.tsx:6 | ✅ Match | `import { Plus, Shield, Users } from 'lucide-react'` |
| "전체 회원 검색" Link 버튼 | page.tsx:62-65 | ⚠️ Partial | 빈 클럽 early return 분기에만 적용됨 (아래 상세) |
| `btn-secondary` 스타일 적용 | page.tsx:62 | ✅ Match | |
| 기존 "클럽 생성" 버튼 유지 | page.tsx:66-69 | ✅ Match | |

**불일치 상세 -- `/admin/clubs/page.tsx` 버튼 배치:**

설계 Section 6에서는 헤더의 "클럽 생성" 버튼 옆에 "전체 회원 검색" 버튼을 추가하도록 지시했다. 구현에서는:
- **빈 클럽 목록 분기** (line 61-69): 두 버튼 모두 `<div className="flex gap-2">` 안에 올바르게 배치됨 ✅
- **일반 클럽 목록 분기** (line 123-126): "클럽 생성" 버튼만 있고 "전체 회원 검색" 버튼 누락 ❌

이 불일치는 클럽이 1개 이상 있는 사용자에게 "전체 회원 검색" 버튼이 보이지 않음을 의미한다. AdminSidebar 메뉴로 접근 가능하므로 심각도는 Medium.

---

## 3. Match Rate Summary

### 3.1 항목별 매칭

| Category | Total Items | Match | Changed | Missing | Added |
|----------|:-----------:|:-----:|:-------:|:-------:|:-----:|
| 타입 정의 | 2 | 2 | 0 | 0 | 0 |
| Server Action | 11 | 10 | 1 | 0 | 0 |
| 페이지 (Server Component) | 10 | 10 | 0 | 0 | 0 |
| 컴포넌트 (Client) | 18 | 16 | 2 | 0 | 0 |
| 기존 파일 수정 | 4 | 3 | 0 | 1 | 0 |
| **합계** | **45** | **41** | **3** | **1** | **1** |

### 3.2 Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 98% | ✅ |
| Architecture Compliance | 100% | ✅ |
| Convention Compliance | 100% | ✅ |
| **Overall** | **98%** | ✅ |

---

## 4. Differences Found

### 4.1 Missing Features (Design O, Implementation X)

| Item | Design Location | Description | Severity |
|------|-----------------|-------------|----------|
| 일반 목록 분기의 "전체 회원 검색" 버튼 | design Section 6 | `/admin/clubs/page.tsx` 메인 return 분기(line 114-131)에 "전체 회원 검색" 버튼 미적용. 빈 클럽 분기에만 적용됨. | Medium |

### 4.2 Added Features (Design X, Implementation O)

| Item | Implementation Location | Description | Severity |
|------|------------------------|-------------|----------|
| AdminSidebar "클럽 회원 검색" 메뉴 | `src/components/admin/AdminSidebar.tsx:59-64` | 사이드바에 독립 메뉴 항목 추가 (UserSearch 아이콘). `excludePrefix` 로직으로 클럽 관리 메뉴와 하이라이트 충돌 방지. | Low (UX 개선) |

### 4.3 Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|--------|
| 변수명 | `members` (getAllClubMembers 결과) | `result` | Low (기능 동일) |
| ROLE_BADGE variant 타입 | inline union type | `BadgeVariant` import | Low (더 나은 패턴) |
| CSS class 순서 | `text-(--accent-color) font-medium` | `font-medium text-(--accent-color)` | None (순서 무관) |

---

## 5. Convention Compliance

### 5.1 Naming Convention

| Category | Convention | Status |
|----------|-----------|--------|
| 컴포넌트 | PascalCase (`AllMembersSearch`) | ✅ |
| 함수 | camelCase (`getAllClubMembers`, `handleQueryChange`) | ✅ |
| 상수 | UPPER_SNAKE_CASE (`ROLE_BADGE`, `GENDER_LABEL`) | ✅ |
| 파일 (컴포넌트) | PascalCase (`AllMembersSearch.tsx`) | ✅ |
| 타입 | PascalCase (`MemberWithClub`) | ✅ |

### 5.2 Accessibility

| Item | Status |
|------|--------|
| input aria-label | ✅ `aria-label="회원 검색"` |
| Link 요소 (클릭 가능) | ✅ `<Link>` 태그 사용 |
| 시맨틱 마크업 | ✅ `<nav>`, `<h1>` 적절 사용 |

### 5.3 Import Order

| File | Status |
|------|--------|
| AllMembersSearch.tsx | ✅ react -> next -> lucide -> @/ -> type imports |
| page.tsx (members) | ✅ next -> lucide -> @/ |
| page.tsx (clubs) | ✅ next -> lucide -> @/ |

---

## 6. Architecture Compliance

| Layer | Component | Expected Location | Actual Location | Status |
|-------|-----------|-------------------|-----------------|--------|
| Domain | `MemberWithClub` type | `src/lib/clubs/types.ts` | `src/lib/clubs/types.ts` | ✅ |
| Application | `getAllClubMembers()` | `src/lib/clubs/actions.ts` | `src/lib/clubs/actions.ts` | ✅ |
| Presentation | `AllMembersSearch` | `src/components/clubs/` | `src/components/clubs/` | ✅ |
| Presentation | `AllMembersPage` | `src/app/admin/clubs/members/` | `src/app/admin/clubs/members/` | ✅ |

의존 방향: Page -> Server Action -> Admin Client (정방향) ✅

---

## 7. Recommended Actions

### 7.1 Immediate

| Priority | Item | File | Description |
|----------|------|------|-------------|
| Medium | 메인 분기 버튼 추가 | `src/app/admin/clubs/page.tsx:123` | 일반 목록 렌더링 분기에도 "전체 회원 검색" 버튼 추가 필요 |

### 7.2 Documentation Update

| Item | Description |
|------|-------------|
| AdminSidebar 반영 | 설계 문서에 AdminSidebar 메뉴 추가 항목 반영 (Section 6에 추가) |

---

## 8. Design Document Updates Needed

- [ ] Section 6에 AdminSidebar "클럽 회원 검색" 메뉴 추가 반영
- [ ] `excludePrefix` 패턴 설명 추가 (클럽 관리 vs 클럽 회원 검색 메뉴 하이라이트 분리)

---

## 9. Verification Checklist (Section 8 대조)

| Checklist Item | Status |
|----------------|--------|
| `MemberWithClub` 타입 추가 + tsc 통과 | ✅ |
| `getAllClubMembers()` ADMIN 전체 반환 | ✅ |
| `getAllClubMembers()` MANAGER 관리 클럽만 | ✅ |
| `/admin/clubs/members` 정상 렌더링 | ✅ |
| 한글 초성 검색 | ✅ (`matchesKoreanSearch`) |
| 전화번호 부분 검색 | ✅ (`.includes()`) |
| URL `?q=` 디바운스 300ms | ✅ |
| 직접 접근 시 초기 검색어 반영 | ✅ (`searchParams.q` -> `initialQuery`) |
| 결과 행 클릭 -> 클럽 페이지 이동 | ✅ (`/admin/clubs/${member.club_id}`) |
| 클럽 관리 페이지에 버튼 표시 | ⚠️ 빈 클럽 분기만 |

---

## 10. Next Steps

- [ ] `/admin/clubs/page.tsx` 메인 분기에 "전체 회원 검색" 버튼 추가
- [ ] 설계 문서에 AdminSidebar 항목 반영
- [ ] Completion report 생성 (`/pdca report members-search`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-16 | Initial analysis | Claude (gap-detector) |
