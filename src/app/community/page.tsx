'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getPostsFeed } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { FeedCard } from '@/components/community/FeedCard'
import { PenLine, Loader2, Search } from 'lucide-react'
import { seedPosts } from '@/lib/community/seed'
import type { Post } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

const isDev = process.env.NODE_ENV === 'development'
const FEED_LIMIT = 5

// 모듈 레벨 캐시: 뒤로가기 시 재조회 없이 즉시 렌더링 (검색 없는 기본 피드만)
type FeedCache = { posts: Post[]; nextCursor: string | null }
let feedCache: FeedCache | null = null

export default function CommunityPage() {
  const { user, profile } = useAuth()
  const canWrite = hasMinimumRole(profile?.role as UserRole, 'MANAGER')
  const isLoggedIn = !!user

  const [posts, setPosts] = useState<Post[]>(feedCache?.posts ?? [])
  const [loading, setLoading] = useState(!feedCache)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(feedCache?.nextCursor ?? null)

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // 무한 스크롤 감지 엘리먼트
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 초기 로드 (검색어 변경 시에도 재실행)
  const loadInitial = useCallback(async () => {
    // 검색 없는 기본 피드는 캐시가 있으면 재조회 생략
    if (!search && feedCache) return
    setLoading(true)
    const result = await getPostsFeed({ limit: FEED_LIMIT, search: search || undefined })
    if (!result.error) {
      setPosts(result.data)
      setNextCursor(result.nextCursor)
      // 검색 없는 기본 피드만 캐시 저장
      if (!search) feedCache = { posts: result.data, nextCursor: result.nextCursor }
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // 추가 로드
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const result = await getPostsFeed({ cursor: nextCursor, limit: FEED_LIMIT, search: search || undefined })
    if (!result.error) {
      setPosts((prev) => [...prev, ...result.data])
      setNextCursor(result.nextCursor)
    }
    setLoadingMore(false)
  }, [nextCursor, loadingMore])

  // IntersectionObserver로 무한 스크롤
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore, loadMore])

  return (
    <div className="max-w-content mx-auto px-6 py-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-display mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            커뮤니티
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            테니스 관련 정보와 이야기를 공유해보세요.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/community/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--bg-primary)',
            }}
          >
            <PenLine className="w-4 h-4" />
            글쓰기
          </Link>
        )}
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="제목 또는 내용으로 검색..."
          aria-label="게시글 검색"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm outline-none border border-(--border-color) focus:border-(--accent-color)"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* DEV: 더미 데이터 시드 */}
      {isDev && posts.length === 0 && !loading && (
        <div className="mb-4 p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
          <button
            type="button"
            onClick={async () => {
              const result = await seedPosts()
              if (result.error) {
                alert(result.error)
              } else {
                alert(`${result.count}개 포스트 시드 완료`)
                loadInitial()
              }
            }}
            className="text-sm font-medium text-amber-600 dark:text-amber-400"
          >
            DEV: 더미 포스트 20개 시드
          </button>
        </div>
      )}

      {/* 피드 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl animate-pulse">
              {/* 헤더 스켈레톤 */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-9 h-9 rounded-full"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
                <div className="flex-1 space-y-1.5">
                  <div
                    className="h-3.5 w-24 rounded"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                  />
                </div>
              </div>
              {/* 본문 스켈레톤 */}
              <div className="px-4 pb-3 space-y-2">
                <div
                  className="h-4 w-3/4 rounded"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
                <div
                  className="h-3 w-full rounded"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
                <div
                  className="h-3 w-2/3 rounded"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
              </div>
              {/* 이미지 스켈레톤 */}
              <div
                className="w-full"
                style={{
                  aspectRatio: '4/3',
                  backgroundColor: 'var(--bg-card-hover)',
                }}
              />
              {/* 액션바 스켈레톤 */}
              <div className="flex gap-5 px-4 py-3">
                <div
                  className="h-4 w-12 rounded"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
                <div
                  className="h-4 w-12 rounded"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
            {search ? '검색 결과가 없습니다' : '아직 작성된 글이 없습니다'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? '다른 검색어를 시도해보세요.' : '첫 번째 글을 작성해보세요.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map((post) => (
            <FeedCard key={post.id} post={post} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      )}

      {/* 무한 스크롤 sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* 추가 로딩 스피너 */}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      )}

      {/* 끝 표시 */}
      {!loading && !nextCursor && posts.length > 0 && (
        <p
          className="text-center text-sm py-6"
          style={{ color: 'var(--text-muted)' }}
        >
          모든 게시글을 불러왔습니다
        </p>
      )}
    </div>
  )
}
