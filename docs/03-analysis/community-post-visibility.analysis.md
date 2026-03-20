# Gap Analysis: 커뮤니티 글 공개/비공개 설정 (community-post-visibility)

> **Date**: 2026-03-20
> **Design**: [community-post-visibility.design.md](../02-design/features/community-post-visibility.design.md)
> **Match Rate**: 100%

---

## 1. FR 요구사항 매핑 검증

| FR | 요구사항 | 설계 항목 | 구현 상태 | 비고 |
|----|---------|----------|----------|------|
| FR-01 | 수정 폼에 비공개 토글 | Step 4 (edit page) | ✅ 완료 | |
| FR-02 | 비공개 글 목록 미노출 | Step 3a (getPostsFeed 필터) | ✅ 완료 | |
| FR-03 | 목록 카드 잠금 아이콘 | Step 6 (FeedCard) | ✅ 완료 | |
| FR-04 | 상세 비공개 배지 | Step 5 (CommunityPostClient) | ✅ 완료 | |
| FR-05 | 직접 URL 접근 시 권한 오류 | Step 3b (getPost 권한 체크) | ✅ 완료 | |
| FR-06 | 비공개 → 공개 재전환 | Step 4 (토글 양방향) | ✅ 완료 | |
| FR-07 | ADMIN+ 전체 관리 | Step 3a/3b (isAdmin 분기) | ✅ 완료 | |

---

## 2. 파일별 구현 검증

### Step 1: `supabase/migrations/50_post_visibility.sql` ✅

설계:
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
```
구현: 설계와 동일, Supabase에 적용 완료.

---

### Step 2: `src/lib/community/types.ts` ✅

설계: `Post.is_published: boolean`, `UpdatePostInput.is_published?: boolean` 추가
구현: 양쪽 모두 정확히 추가됨.

---

### Step 3: `src/lib/community/actions.ts` ✅

#### 3a. `getPostsFeed` — visibility 필터
설계:
```ts
const isAdmin = user ? hasMinimumRole(user.role as UserRole, 'ADMIN') : false
if (!isAdmin) {
  if (user) { query = query.or(`is_published.eq.true,author_id.eq.${user.id}`) }
  else { query = query.eq('is_published', true) }
}
```
구현: 설계와 동일.

#### 3b. `getPost` — 비공개 접근 제어
설계: 2-way `Promise.all([currentUser, {data, error}])`
구현: 3-way `Promise.all([{view_count}, {data, error}, currentUser])` — 기존 view_count 병렬 구조 유지 (설계 주의사항 준수, 오히려 향상)

비공개 체크 로직은 설계와 동일:
```ts
if (!post.is_published) {
  const isAdmin = currentUser ? hasMinimumRole(currentUser.role as UserRole, 'ADMIN') : false
  const isAuthor = currentUser?.id === post.author_id
  if (!isAdmin && !isAuthor) return { data: null, error: '접근 권한이 없습니다.' }
}
```

#### 3c. `updatePost` — `is_published` 허용
설계/구현 동일:
```ts
if (input.is_published !== undefined) updateData.is_published = input.is_published
```

---

### Step 4: `src/app/community/[id]/edit/page.tsx` ✅

설계:
- `isPublished` state, `loadPost` 후 초기값 설정
- `updatePost` 호출 시 `is_published: isPublished` 추가
- 토글 UI (`role="switch"`, `aria-checked`)

구현: 모두 충족. 미세 차이:
- 설계: `비공개 (나와 관리자만 볼 수 있습니다)` → 구현: `비공개 — 나와 관리자만 볼 수 있습니다` (em dash, 의미 동일)
- `dark:bg-gray-600` 다크모드 클래스 추가 (설계 개선)
- `aria-label="공개/비공개 전환"` + `focus-visible` 링 추가 (접근성 향상)

---

### Step 5: `src/app/community/[id]/_components/CommunityPostClient.tsx` ✅

설계: `{!post.is_published && <Badge variant="warning">비공개</Badge>}`
구현: 카테고리 배지 영역에 정확히 동일하게 추가됨.

---

### Step 6: `src/components/community/FeedCard.tsx` ✅

설계: `Lock` 아이콘 + `aria-label="비공개 글"`
구현: 동일. `w-3.5 h-3.5 shrink-0` 크기와 `var(--text-muted)` 색상도 일치.

---

## 3. Gap 목록

| # | 항목 | 심각도 | 내용 |
|---|------|--------|------|
| - | Gap 없음 | - | 모든 FR 구현 완료 |

설계 대비 구현이 개선된 항목:
- `getPost` 3-way `Promise.all` (설계 주의사항 반영하여 view_count 병렬 구조 유지)
- 토글 버튼 `focus-visible` 링 + `dark:bg-gray-600` 다크모드 추가 (접근성/UX 향상)

---

## 4. 결론

**Match Rate: 100%** — 모든 FR(FR-01 ~ FR-07), 6개 파일 변경 모두 설계 명세 충족.
구현 과정에서 접근성 속성(aria-label, focus-visible) 추가 및 view_count 병렬 구조 유지 등 설계보다 향상된 부분 존재.
