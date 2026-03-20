# Plan: 커뮤니티 글 공개/비공개 설정 (community-post-visibility)

## 개요

커뮤니티 글 수정 시 "비공개" 전환 옵션을 추가한다.
비공개 글은 작성자 본인과 ADMIN+에게만 표시된다.

## 배경 및 목적

- 현재 커뮤니티 글은 작성 즉시 전체 공개, 비공개 설정 없음
- 작성자가 임시로 글을 숨기거나, 수정 중에 노출을 막고 싶은 수요
- 삭제 없이 비공개 전환 → 나중에 다시 공개 가능

## 현황 분석

### 현재 구조

| 레이어 | 현재 상태 |
|--------|---------|
| DB `posts` | `is_published` 컬럼 없음 |
| `Post` 타입 | `is_published` 필드 없음 |
| `UpdatePostInput` | visibility 옵션 없음 |
| `getPosts()` | 전체 조회 (필터 없음) |
| `getPost()` | 단건 조회 (권한 무관) |
| `updatePost()` | title/content/category/attachments만 수정 가능 |
| 수정 UI | 비공개 토글 없음 |

### 관련 파일

| 파일 | 역할 |
|------|-----|
| `src/lib/community/types.ts` | `Post`, `UpdatePostInput` 타입 정의 |
| `src/lib/community/actions.ts` | `getPosts`, `getPost`, `updatePost` |
| `src/app/community/page.tsx` | 목록 페이지 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 상세 + 수정 UI |
| `src/components/community/FeedCard.tsx` | 목록 카드 |
| `supabase/migrations/` | DB 마이그레이션 |

## 범위 (Scope)

### In-Scope

- **DB**: `posts` 테이블에 `is_published boolean DEFAULT true NOT NULL` 컬럼 추가
- **RLS**: 비공개 글은 작성자 본인 + ADMIN+만 조회 가능
- **타입**: `Post.is_published`, `UpdatePostInput.is_published` 추가
- **Server Actions**: `getPosts` / `getPost` 필터링, `updatePost` 비공개 설정 허용
- **수정 UI**: 글 수정 폼에 공개/비공개 토글
- **목록 UI**: 본인의 비공개 글에 잠금 아이콘 표시
- **상세 UI**: 비공개 글 상단에 "비공개 글" 배지 표시

### Out-of-Scope

- 작성 시 비공개 설정 (수정 시에만 지원)
- 비공개 글 전용 목록 페이지
- 비공개 글 링크 공유 (토큰 기반 접근)

## 요구사항

### 기능 요구사항

| ID | 요구사항 |
|----|---------|
| FR-01 | 글 수정 폼에 "비공개로 전환" 토글 제공 |
| FR-02 | 비공개 글은 목록에서 본인(+ ADMIN+)에게만 노출 |
| FR-03 | 비공개 글 목록 카드에 잠금 아이콘 표시 |
| FR-04 | 비공개 글 상세 상단에 "비공개 글입니다" 배지 표시 |
| FR-05 | 비공개 글 URL 직접 접근 시 비회원·타인은 404 또는 권한 오류 |
| FR-06 | 비공개 → 공개 재전환 가능 (토글 재클릭) |
| FR-07 | ADMIN+는 모든 비공개 글 조회·수정 가능 |

### 비기능 요구사항

- DB 레벨 RLS로 비공개 글 데이터 자체 보호 (API 우회 차단)
- 기존 공개 글은 `is_published = true`로 마이그레이션 (DEFAULT true이므로 자동)
- 수정 폼 토글은 기존 UI 패턴(스위치 또는 체크박스) 일관성 유지

## 구현 계획

### Step 1: DB 마이그레이션

```sql
-- supabase/migrations/XX_post_visibility.sql
ALTER TABLE posts
  ADD COLUMN is_published boolean NOT NULL DEFAULT true;

-- RLS: 비공개 글은 작성자 + ADMIN+만 조회
-- (기존 SELECT 정책 수정 또는 추가)
```

### Step 2: 타입 업데이트

- `Post` 인터페이스에 `is_published: boolean` 추가
- `UpdatePostInput`에 `is_published?: boolean` 추가

### Step 3: Server Actions 수정

- `getPosts()`: `is_published = true OR author_id = 현재유저` 필터
- `getPost()`: 비공개 글 접근 시 작성자/ADMIN+ 아닌 경우 `{ data: null, error: '권한이 없습니다.' }` 반환
- `updatePost()`: `is_published` 업데이트 허용

### Step 4: UI 수정

- `CommunityPostClient.tsx` 수정 폼: 비공개 토글 추가
- `FeedCard.tsx`: `is_published = false`이면 잠금 아이콘 표시
- `CommunityPostClient.tsx` 상세: 비공개 배지 표시

## 예상 파일 변경

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `supabase/migrations/XX_post_visibility.sql` | 신규 | `is_published` 컬럼 추가 + RLS 정책 수정 |
| `src/lib/community/types.ts` | 수정 | `Post`, `UpdatePostInput`에 `is_published` 추가 |
| `src/lib/community/actions.ts` | 수정 | `getPosts`, `getPost`, `updatePost` 비공개 처리 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 수정 | 수정 폼 토글 + 상세 배지 |
| `src/components/community/FeedCard.tsx` | 수정 | 잠금 아이콘 |

## 성공 지표

- 비공개 전환 글이 타인 목록/상세에서 미노출
- 비공개 글 URL 직접 접근 시 권한 오류
- 작성자 본인은 목록에서 비공개 글 확인 가능 (잠금 아이콘)
- ADMIN+는 전체 비공개 글 관리 가능
- 기존 공개 글 영향 없음
