# Design: 커뮤니티 글 공개/비공개 설정 (community-post-visibility)

> **Plan**: [community-post-visibility.plan.md](../../01-plan/features/community-post-visibility.plan.md)
> **Status**: Design
> **Date**: 2026-03-20

---

## 1. 현황 분석

### 관련 파일 구조

```
src/
├── lib/community/
│   ├── actions.ts          # getPosts, getPostsFeed, getPost, updatePost
│   └── types.ts            # Post, UpdatePostInput
├── app/community/
│   ├── page.tsx            # 목록 (useClient, getPostsFeed 호출)
│   └── [id]/
│       ├── edit/page.tsx   # 수정 페이지 — handleSubmit → updatePost
│       └── _components/CommunityPostClient.tsx  # 상세 뷰
└── components/community/
    ├── PostForm.tsx         # 수정 폼 컴포넌트 (category/title/content/attachments)
    └── FeedCard.tsx         # 목록 카드
```

### 핵심 파악 사항

- **목록**: `getPostsFeed()` — admin client로 쿼리, `getCurrentUser()`를 이미 호출 중 (좋아요 체크)
- **수정 흐름**: `[id]/edit/page.tsx` → `PostForm.onSubmit(data)` → `updatePost(id, {...data})`
- **`PostForm`**: `CreatePostInput` 기반 (category/title/content/attachments) — 비공개 필드 없음
- **권한**: `updatePost`에서 본인 글 또는 ADMIN+ 확인

---

## 2. 설계 결정

### 2-1. `PostForm`은 수정하지 않는다

비공개 토글을 `PostForm` 내부에 넣으면 `CreatePostInput` 타입이 오염되고
신규 작성(`/community/new`) 페이지에 불필요한 옵션이 노출된다.

→ **수정 페이지(`[id]/edit/page.tsx`)에 별도 state + 토글 UI 추가**
→ `handleSubmit`에서 `updatePost(id, { ...data, is_published: isPublished })`로 통합

### 2-2. 필터링 위치: Server Action (application level)

모든 쿼리가 `createAdminClient()`(Service Role Key)를 통해 실행되어 RLS 우회됨.
→ DB RLS 대신 **`getPostsFeed` / `getPost` Server Action에서 필터링**.

`getPostsFeed`는 `getCurrentUser()`를 이미 호출하므로 추가 DB 왕복 없이 user 정보 활용 가능.

### 2-3. ADMIN+ 처리

`getPost` / `getPostsFeed`에서 ADMIN+ 역할이면 `is_published`와 무관하게 조회 가능.

---

## 3. 구현 명세

### Step 1: DB 마이그레이션

**파일**: `supabase/migrations/50_post_visibility.sql`

```sql
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN posts.is_published IS '공개 여부. false = 작성자+ADMIN+만 조회 가능';
```

기존 글은 `DEFAULT true`로 자동 마이그레이션 — 영향 없음.

---

### Step 2: 타입 수정

**파일**: `src/lib/community/types.ts`

```ts
export interface Post {
  // ...기존 필드...
  is_published: boolean  // 추가
}

export interface UpdatePostInput {
  title?: string
  content?: string
  category?: PostCategory
  attachments?: PostAttachment[]
  is_published?: boolean  // 추가
}
```

---

### Step 3: Server Actions 수정

**파일**: `src/lib/community/actions.ts`

#### 3-1. `getPostsFeed` — visibility 필터 추가

`user`는 이미 `getCurrentUser()`로 확보된 상태이므로 추가 쿼리 불필요.

```ts
// user 확보 후 필터 적용
const isAdmin = user ? hasMinimumRole(user.role as UserRole, 'ADMIN') : false

let query = admin
  .from('posts')
  .select('*, author:profiles!author_id(name, avatar_url)')
  .order('is_pinned', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(limit)

// 비공개 필터: ADMIN+는 전체 조회, 그 외는 공개 글 + 본인 글만
if (!isAdmin) {
  if (user) {
    query = query.or(`is_published.eq.true,author_id.eq.${user.id}`)
  } else {
    query = query.eq('is_published', true)
  }
}
```

#### 3-2. `getPost` — 비공개 글 접근 제어

```ts
export async function getPost(id: string): Promise<{ data: Post | null; error?: string }> {
  // ...기존 idErr 검증...

  const [currentUser, { data, error }] = await Promise.all([
    getCurrentUser().catch(() => null),
    admin.from('posts').select('*, author:profiles!author_id(name, avatar_url)').eq('id', id).single(),
  ])

  if (error || !data) return { data: null, error: '게시글을 찾을 수 없습니다.' }

  const post = data as Post

  // 비공개 글: 작성자 본인 또는 ADMIN+만 조회 가능
  if (!post.is_published) {
    const isAdmin = currentUser ? hasMinimumRole(currentUser.role as UserRole, 'ADMIN') : false
    const isAuthor = currentUser?.id === post.author_id
    if (!isAdmin && !isAuthor) {
      return { data: null, error: '접근 권한이 없습니다.' }
    }
  }

  // 조회수 업데이트 (fire-and-forget) — 기존 로직 유지
  // ...
}
```

> **주의**: 기존 `getPost`는 `view_count` 업데이트를 위해 `current` 조회와 병렬로 `data` 조회를 진행함. 수정 시 이 구조 유지.

#### 3-3. `updatePost` — `is_published` 허용

```ts
// 기존 updateData 빌드 로직에 추가
if (input.is_published !== undefined) {
  updateData.is_published = input.is_published
}
```

---

### Step 4: 수정 페이지 UI

**파일**: `src/app/community/[id]/edit/page.tsx`

```tsx
// state 추가
const [isPublished, setIsPublished] = useState<boolean>(true)

// post 로드 후 초기값 설정
setPost(result.data)
setIsPublished(result.data.is_published)

// handleSubmit에 is_published 추가
const result = await updatePost(id, {
  category: data.category,
  title: data.title,
  content: data.content,
  attachments: data.attachments,
  is_published: isPublished,
})

// glass-card 상단에 토글 UI 삽입 (PostForm 위)
<div className="glass-card rounded-xl p-6 mb-4">
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>공개 설정</p>
      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {isPublished ? '전체 공개' : '비공개 (나와 관리자만 볼 수 있습니다)'}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={isPublished}
      onClick={() => setIsPublished(!isPublished)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        isPublished ? 'bg-emerald-500' : 'bg-gray-400'
      }`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
        isPublished ? 'left-6' : 'left-0.5'
      }`} />
    </button>
  </div>
</div>
```

---

### Step 5: 상세 뷰 비공개 배지

**파일**: `src/app/community/[id]/_components/CommunityPostClient.tsx`

제목 상단 (카테고리 배지 옆)에 비공개 배지 추가:

```tsx
// 기존 카테고리 배지 영역에 추가
{!post.is_published && (
  <Badge variant="warning">비공개</Badge>
)}
```

---

### Step 6: 목록 카드 잠금 아이콘

**파일**: `src/components/community/FeedCard.tsx`

제목 앞에 잠금 아이콘 (본인 글 비공개 시에만 표시 — 타인에겐 카드 자체가 안 보임):

```tsx
import { Lock } from 'lucide-react'

// 제목 렌더링 부분
<h3 className="font-semibold flex items-center gap-1.5">
  {!post.is_published && (
    <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
  )}
  {post.title}
</h3>
```

---

## 4. 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `supabase/migrations/50_post_visibility.sql` | **신규** | `is_published` 컬럼 추가 |
| `src/lib/community/types.ts` | 수정 | `Post.is_published`, `UpdatePostInput.is_published` 추가 |
| `src/lib/community/actions.ts` | 수정 | `getPostsFeed` 필터, `getPost` 권한 체크, `updatePost` 허용 |
| `src/app/community/[id]/edit/page.tsx` | 수정 | `isPublished` state + 토글 UI + `updatePost` 전달 |
| `src/app/community/[id]/_components/CommunityPostClient.tsx` | 수정 | 비공개 배지 |
| `src/components/community/FeedCard.tsx` | 수정 | 잠금 아이콘 |

---

## 5. 구현 순서 체크리스트

```
[ ] Step 1: supabase/migrations/50_post_visibility.sql 생성 + Supabase 적용
[ ] Step 2: types.ts — Post.is_published, UpdatePostInput.is_published 추가
[ ] Step 3a: actions.ts — getPostsFeed visibility 필터
[ ] Step 3b: actions.ts — getPost 비공개 접근 제어
[ ] Step 3c: actions.ts — updatePost is_published 허용
[ ] Step 4: [id]/edit/page.tsx — isPublished state + 토글 UI
[ ] Step 5: CommunityPostClient.tsx — 비공개 배지
[ ] Step 6: FeedCard.tsx — 잠금 아이콘
[ ] TypeScript 빌드 확인 (npx tsc --noEmit)
```

---

## 6. 요구사항 매핑

| FR | 요구사항 | 설계 항목 |
|----|---------|----------|
| FR-01 | 수정 폼에 비공개 토글 | Step 4 (edit page) |
| FR-02 | 비공개 글 목록 미노출 | Step 3a (getPostsFeed 필터) |
| FR-03 | 목록 카드 잠금 아이콘 | Step 6 (FeedCard) |
| FR-04 | 상세 비공개 배지 | Step 5 (CommunityPostClient) |
| FR-05 | 직접 URL 접근 시 권한 오류 | Step 3b (getPost 권한 체크) |
| FR-06 | 비공개 → 공개 재전환 | Step 4 (토글 양방향) |
| FR-07 | ADMIN+ 전체 관리 | Step 3a/3b (isAdmin 분기) |

---

## 7. 주요 설계 결정 근거

### PostForm 비수정 원칙
- `CreatePostInput`에 `is_published` 추가 시 신규 작성 폼에도 노출 → Plan의 Out-of-Scope 위반
- 수정 페이지에서 별도 state로 관리하면 두 흐름이 완전히 독립됨

### 필터링 위치
- 모든 쿼리가 admin client → RLS 무의미
- `getPostsFeed`는 `user`를 이미 보유 → 추가 쿼리 없이 `or()` 필터로 처리

### `getPost` 병렬 구조 유지
- 기존 `view_count` 조회와 `data` 조회가 `Promise.all`로 병렬 처리됨
- `getCurrentUser()` 추가 시 3-way `Promise.all`로 확장하여 성능 유지
