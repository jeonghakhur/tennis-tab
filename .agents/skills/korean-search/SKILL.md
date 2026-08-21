---
name: korean-search
description: 한글 초성 검색 + URL 동기화 클라이언트 검색 기능 구현 가이드. 목록 페이지에 검색 기능을 추가할 때 사용.
language: typescript,tsx
framework: react,nextjs
allowed-tools: Read, Write, Edit, Glob
---

# 한글 초성 검색 + URL 동기화 패턴

목록 페이지에 클라이언트 검색 기능을 추가할 때 이 패턴을 따른다.

## 아키텍처

```
[서버 컴포넌트]           [클라이언트 컴포넌트]            [URL]
데이터 fetch + 전달  →  useState(즉각 반응)  ──blur──→  ?q=ㅅㅊ (history.replaceState)
                        useMemo(필터링)       ←──초기값──   searchParams.get('q')
```

- 로컬 `useState`로 타이핑 즉각 반응
- 입력 필드 blur 시 `history.replaceState`로 URL 동기적 갱신 (서버 refetch 없음)
- 하위 페이지 링크에 `?q=` 전달 → 뒤로가기/저장 후 검색 결과 유지

> **주의**: `router.replace`를 매 키입력마다 호출하면 서버 컴포넌트 refetch로 입력이 느려진다. blur + `history.replaceState`를 사용해야 한다.

## 유틸리티

**파일**: `src/lib/utils/korean.ts`

| 함수 | 설명 |
|------|------|
| `getChosung(char)` | 한글 음절 → 초성 추출 (유니코드 연산) |
| `isChosung(char)` | 문자가 자음(초성)인지 판별 |
| `matchesKoreanSearch(target, query)` | 초성/일반 텍스트 혼합 검색 |

### matchesKoreanSearch 매칭 전략 (순서대로 시도)
1. **일반 substring**: `"서초"` → `"서초구테니스협회"` ✅
2. **전체 초성**: `"ㅅㅊ"` → `"서초구테니스협회"` ✅
3. **혼합 (완성형+초성)**: `"서ㅊ"` → `"서초구테니스협회"` ✅

## 구현 템플릿

### 클라이언트 컴포넌트 (검색 + 목록)

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { matchesKoreanSearch } from '@/lib/utils/korean'

interface Props {
  items: Item[]
}

export function XxxList({ items }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // ① 로컬 state (URL 파라미터로 초기화)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')

  // ② blur 시 URL 동기화 (동기적, 서버 refetch 없음)
  const syncUrlOnBlur = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    if (searchQuery) {
      params.set('q', searchQuery)
    } else {
      params.delete('q')
    }
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(window.history.state, '', url)
  }, [searchQuery, searchParams, pathname])

  // ③ 검색어 포함 href 생성 (하위 페이지에 ?q= 전달)
  const withSearchQuery = useCallback((path: string) => {
    if (!searchQuery) return path
    const params = new URLSearchParams({ q: searchQuery })
    return `${path}?${params.toString()}`
  }, [searchQuery])

  // ④ useMemo로 필터링 (로컬 state 기반 → 즉각 반응)
  const filtered = useMemo(() => {
    if (!searchQuery) return items
    return items.filter((item) =>
      matchesKoreanSearch(item.name, searchQuery) ||
      (item.field2 && matchesKoreanSearch(item.field2, searchQuery))
    )
  }, [items, searchQuery])

  return (
    <div className="space-y-4">
      {/* ⑤ 검색 입력 필드 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
        <input
          type="text"
          placeholder="이름, 지역으로 검색 (초성 지원: ㅅㅊ → 서초)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={syncUrlOnBlur}
          aria-label="검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-secondary) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent-color) focus:outline-none transition-colors"
        />
      </div>

      {/* ⑥ 결과 카운트 (검색 중일 때만) */}
      {searchQuery && (
        <p className="text-sm text-(--text-muted)">
          검색 결과: <span className="font-semibold text-(--text-primary)">{filtered.length}</span>개
          {filtered.length !== items.length && (
            <span> / 전체 {items.length}개</span>
          )}
        </p>
      )}

      {/* ⑦ 빈 결과 분기 */}
      {filtered.length === 0 ? (
        <p>{searchQuery ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}</p>
      ) : (
        filtered.map(item => (
          <div key={item.id}>
            {/* ⑧ 하위 페이지 링크에 검색어 전달 */}
            <Link href={withSearchQuery(`/xxx/${item.id}`)}>수정</Link>
          </div>
        ))
      )}
    </div>
  )
}
```

### 서버 컴포넌트 — 목록 페이지 (page.tsx)

```tsx
// 타입을 export해서 클라이언트 컴포넌트에서 import
export type XxxItem = { id: string; name: string; /* ... */ }

export default async function Page() {
  const items = await fetchData()
  return (
    <div className="space-y-6">
      {/* 헤더는 서버 컴포넌트에 유지 */}
      <div className="flex items-center justify-between">
        <h1>제목</h1>
        <Link href="/xxx/new" className="btn-primary btn-sm">생성</Link>
      </div>
      {/* 검색+목록은 클라이언트 컴포넌트로 분리 */}
      <XxxList items={items} />
    </div>
  )
}
```

### 서버 컴포넌트 — 하위 페이지 (수정/상세)

하위 페이지에서 `?q=`를 읽어서 뒤로가기 링크와 저장 후 redirect에 전달한다.

```tsx
interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function EditPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams
  // 검색어가 있으면 목록 URL에 포함
  const listUrl = q ? `/xxx?q=${encodeURIComponent(q)}` : '/xxx'

  return (
    <div>
      {/* 뒤로가기 링크에 검색어 유지 */}
      <Link href={listUrl}>
        <ChevronLeft />
      </Link>

      {/* 폼 컴포넌트에 returnUrl 전달 */}
      <XxxForm item={item} returnUrl={listUrl} />
    </div>
  )
}
```

### 클라이언트 폼 — 저장 후 검색 결과로 복귀

```tsx
interface FormProps {
  item?: Item
  returnUrl?: string  // 검색어 포함 목록 URL
}

export function XxxForm({ item, returnUrl = '/xxx' }: FormProps) {
  const router = useRouter()

  const handleSubmit = async () => {
    await saveData()
    // 검색어가 포함된 목록 URL로 이동
    setTimeout(() => router.push(returnUrl), 500)
  }
}
```

## 검색어 전달 흐름

```
목록 (?q=ㅅㅊ) → 수정 클릭 → /xxx/123?q=ㅅㅊ
                                ↓
                  서버: searchParams.q 읽기
                  → ChevronLeft href="/xxx?q=ㅅㅊ"
                  → Form returnUrl="/xxx?q=ㅅㅊ"
                                ↓
                  저장 후 router.push("/xxx?q=ㅅㅊ")
                  → 목록 페이지 (?q=ㅅㅊ) → 검색 결과 유지 ✅
```

브라우저 뒤로가기도 `history.replaceState`로 URL이 갱신되어 있으므로 자동으로 검색 유지.

## 체크리스트

- [ ] `matchesKoreanSearch` import (`src/lib/utils/korean.ts`)
- [ ] `useState` 초기값을 `searchParams.get('q')`로 설정
- [ ] `onBlur`에서 `history.replaceState`로 URL 동기화 (router.replace 금지)
- [ ] `withSearchQuery` 헬퍼로 하위 페이지 Link href에 `?q=` 포함
- [ ] 하위 페이지에서 `searchParams.q` 읽어서 뒤로가기 Link에 전달
- [ ] 폼 컴포넌트에 `returnUrl` prop → 저장 후 `router.push(returnUrl)`
- [ ] 검색 대상 필드 결정 (name, region 등)
- [ ] `aria-label` 접근성 속성 추가
- [ ] 빈 검색어 → 전체 목록 / 결과 없음 → 안내 메시지

## 적용 사례

- `src/components/associations/AssociationList.tsx` — 협회 목록 (name, region, district 검색)
- `src/app/admin/associations/[id]/page.tsx` — 수정 페이지 (listUrl + returnUrl 전달)
- `src/app/admin/associations/[id]/managers/page.tsx` — 매니저 페이지 (listUrl 전달)
- `src/components/associations/AssociationForm.tsx` — returnUrl로 저장 후 복귀

ARGUMENTS: $ARGUMENTS
