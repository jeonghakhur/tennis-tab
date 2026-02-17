'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { getPosts } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { PostCard } from '@/components/community/PostCard'
import { Search, PenLine } from 'lucide-react'
import type { Post, PostCategory } from '@/lib/community/types'
import { POST_CATEGORY_LABELS } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

// 페이지당 게시글 수
const PAGE_SIZE = 20

// 카테고리 탭 (전체 포함)
const CATEGORY_TABS: { key: PostCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'NOTICE', label: POST_CATEGORY_LABELS.NOTICE },
  { key: 'FREE', label: POST_CATEGORY_LABELS.FREE },
  { key: 'INFO', label: POST_CATEGORY_LABELS.INFO },
  { key: 'REVIEW', label: POST_CATEGORY_LABELS.REVIEW },
]

export default function CommunityPage() {
  const { profile } = useAuth()
  const canWrite = hasMinimumRole(profile?.role as UserRole, 'MANAGER')

  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<PostCategory | 'ALL'>('ALL')

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1) // 검색 시 첫 페이지로
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const result = await getPosts({
      category: category === 'ALL' ? undefined : category,
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
    })
    if (!result.error) {
      setPosts(result.data)
      setTotal(result.total)
    }
    setLoading(false)
  }, [category, page, search])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 카테고리 변경 시 첫 페이지로
  const handleCategoryChange = (cat: PostCategory | 'ALL') => {
    setCategory(cat)
    setPage(1)
  }

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
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

          {/* 카테고리 탭 */}
          <div
            className="flex gap-1 mb-6 overflow-x-auto pb-1"
            role="tablist"
            aria-label="카테고리 필터"
          >
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={category === tab.key}
                onClick={() => handleCategoryChange(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  category === tab.key
                    ? 'text-white'
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: category === tab.key ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                  color: category === tab.key ? 'var(--bg-primary)' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
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

          {/* 포스트 목록 */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-16 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                    <div className="h-5 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  </div>
                  <div className="h-3 w-36 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
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
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <nav
              className="flex justify-center items-center gap-2 mt-8"
              aria-label="페이지 네비게이션"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // 현재 페이지 주변 2개만 표시
                  return Math.abs(p - page) <= 2 || p === 1 || p === totalPages
                })
                .map((p, idx, arr) => {
                  // 생략 표시
                  const prev = arr[idx - 1]
                  const showEllipsis = prev !== undefined && p - prev > 1
                  return (
                    <span key={p} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-1" style={{ color: 'var(--text-muted)' }}>...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          p === page ? 'text-white' : ''
                        }`}
                        style={{
                          backgroundColor: p === page ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                          color: p === page ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                다음
              </button>
            </nav>
          )}
        </div>
      </main>
    </>
  )
}
