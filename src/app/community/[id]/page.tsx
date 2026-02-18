'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getPost, deletePost, togglePinPost } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { CommentSection } from '@/components/community/CommentSection'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import Image from 'next/image'
import { ArrowLeft, Eye, PenLine, Trash2, Pin, Download, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react'
import type { Post, PostCategory, PostAttachment } from '@/lib/community/types'
import { POST_CATEGORY_LABELS } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

const CATEGORY_VARIANT: Record<PostCategory, BadgeVariant> = {
  NOTICE: 'info',
  FREE: 'secondary',
  INFO: 'purple',
  REVIEW: 'orange',
}

/** 문서 아이콘 */
function getDocIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'pdf': case 'doc': case 'docx': case 'hwp':
      return <FileText className="w-5 h-5" />
    case 'xls': case 'xlsx':
      return <FileSpreadsheet className="w-5 h-5" />
    case 'ppt': case 'pptx':
      return <Presentation className="w-5 h-5" />
    default:
      return <File className="w-5 h-5" />
  }
}

/** 파일 크기 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
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
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-8 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-4 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center py-24">
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
      </div>
    )
  }

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <div className="max-w-screen-xl mx-auto px-6 py-6">
          {/* 뒤로가기 */}
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 text-sm mb-4 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>

          {/* 포스트 헤더 */}
          <article className="glass-card rounded-xl p-5 mb-5">
            {/* 카테고리 + 제목 (한 줄) */}
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={CATEGORY_VARIANT[post.category]}>
                {POST_CATEGORY_LABELS[post.category]}
              </Badge>
              {post.is_pinned && (
                <Pin className="w-4 h-4" style={{ color: 'var(--accent-color)' }} aria-label="고정된 글" />
              )}
            </div>
            <h1
              className="text-xl font-display mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {post.title}
            </h1>

            {/* 메타 + 액션 버튼 (한 줄) */}
            <div
              className="flex items-center flex-wrap gap-x-3 gap-y-2 text-xs pb-3 mb-4 border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
            >
              <span>{post.author?.name ?? '알 수 없음'}</span>
              <span>{formatDate(post.created_at)}</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {post.view_count}
              </span>

              {/* 액션 버튼 — 오른쪽 정렬 */}
              {(canModify || isAdminUser) && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {canModify && (
                    <>
                      <Link
                        href={`/community/${post.id}/edit`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <PenLine className="w-3 h-3" />
                        수정
                      </Link>
                      <button
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--court-danger)',
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </>
                  )}
                  {isAdminUser && (
                    <button
                      onClick={handleTogglePin}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Pin className="w-3 h-3" />
                      {post.is_pinned ? '고정 해제' : '고정'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 본문 (리치텍스트 HTML) */}
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              style={{ color: 'var(--text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* 첨부 이미지 */}
            {post.attachments?.filter((a: PostAttachment) => a.type === 'image').length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {post.attachments
                  .filter((a: PostAttachment) => a.type === 'image')
                  .map((att: PostAttachment) => (
                    <a
                      key={att.url}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-[4/3] rounded-lg overflow-hidden block"
                    >
                      <Image
                        src={att.url}
                        alt={att.name}
                        fill
                        className="object-cover hover:scale-105 transition-transform"
                        unoptimized
                      />
                    </a>
                  ))}
              </div>
            )}

            {/* 첨부 문서 */}
            {post.attachments?.filter((a: PostAttachment) => a.type === 'document').length > 0 && (
              <div className="mt-6 space-y-2">
                <h4
                  className="text-xs font-medium mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  첨부파일
                </h4>
                {post.attachments
                  .filter((a: PostAttachment) => a.type === 'document')
                  .map((att: PostAttachment) => (
                    <a
                      key={att.url}
                      href={att.url}
                      download={att.name}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>
                        {getDocIcon(att.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {att.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatSize(att.size)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </a>
                  ))}
              </div>
            )}
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
