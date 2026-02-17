'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { getPost, deletePost, togglePinPost } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { CommentSection } from '@/components/community/CommentSection'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { ArrowLeft, Eye, PenLine, Trash2, Pin } from 'lucide-react'
import type { Post, PostCategory } from '@/lib/community/types'
import { POST_CATEGORY_LABELS } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

const CATEGORY_VARIANT: Record<PostCategory, BadgeVariant> = {
  NOTICE: 'info',
  FREE: 'secondary',
  INFO: 'purple',
  REVIEW: 'orange',
}

/** 날짜 포맷 (YYYY.MM.DD HH:mm) */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, profile } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isAdminUser = hasMinimumRole(profile?.role as UserRole, 'ADMIN')
  const isOwner = user && post?.author_id === user.id
  const canModify = isOwner || isAdminUser

  useEffect(() => {
    if (!id) return
    loadPost()
  }, [id])

  const loadPost = async () => {
    setLoading(true)
    const result = await getPost(id)
    if (result.data) {
      setPost(result.data)
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setConfirmDeleteOpen(false)
    setActionLoading(true)
    const result = await deletePost(id)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '게시글이 삭제되었습니다.', type: 'success' })
    // Toast 표시 후 이동
    setTimeout(() => router.push('/community'), 500)
  }

  const handleTogglePin = async () => {
    if (!post) return
    setActionLoading(true)
    const result = await togglePinPost(id, !post.is_pinned)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({
      isOpen: true,
      message: post.is_pinned ? '고정이 해제되었습니다.' : '게시글이 고정되었습니다.',
      type: 'success',
    })
    loadPost()
  }

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-8 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-4 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!post) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen pt-20 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="text-center">
            <h1 className="text-2xl font-display mb-4" style={{ color: 'var(--text-primary)' }}>
              게시글을 찾을 수 없습니다
            </h1>
            <Link
              href="/community"
              className="text-sm hover:underline"
              style={{ color: 'var(--accent-color)' }}
            >
              목록으로 돌아가기
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navigation />
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>

          {/* 포스트 헤더 */}
          <article className="glass-card rounded-xl p-6 mb-6">
            {/* 카테고리 + 고정 */}
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={CATEGORY_VARIANT[post.category]}>
                {POST_CATEGORY_LABELS[post.category]}
              </Badge>
              {post.is_pinned && (
                <Pin className="w-4 h-4" style={{ color: 'var(--accent-color)' }} aria-label="고정된 글" />
              )}
            </div>

            {/* 제목 */}
            <h1
              className="text-2xl font-display mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {post.title}
            </h1>

            {/* 메타 정보 */}
            <div
              className="flex items-center gap-3 text-sm mb-4"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>{post.author?.name ?? '알 수 없음'}</span>
              <span>{formatDate(post.created_at)}</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {post.view_count}
              </span>
            </div>

            {/* 액션 버튼 */}
            {(canModify || isAdminUser) && (
              <div
                className="flex items-center gap-2 mb-4 pb-4 border-b"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {canModify && (
                  <>
                    <Link
                      href={`/community/${post.id}/edit`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      수정
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        color: 'var(--court-danger)',
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                  </>
                )}
                {isAdminUser && (
                  <button
                    onClick={handleTogglePin}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {post.is_pinned ? '고정 해제' : '고정'}
                  </button>
                )}
              </div>
            )}

            {/* 본문 */}
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {post.content}
            </div>
          </article>

          {/* 댓글 영역 */}
          <div className="glass-card rounded-xl p-6">
            <CommentSection
              postId={post.id}
              currentUserId={user?.id}
              isAdmin={isAdminUser}
            />
          </div>
        </div>
      </main>

      {/* 다이얼로그 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="게시글 삭제"
        message="이 게시글을 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다."
        type="warning"
      />
    </>
  )
}
