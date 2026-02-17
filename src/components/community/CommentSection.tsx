'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Send } from 'lucide-react'
import { getComments, createComment, deleteComment } from '@/lib/community/actions'
import { AlertDialog, Toast, ConfirmDialog } from '@/components/common/AlertDialog'
import type { PostComment } from '@/lib/community/types'

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

// 댓글 최대 글자 수
const COMMENT_MAX_LENGTH = 1000

interface CommentSectionProps {
  postId: string
  currentUserId?: string
  isAdmin?: boolean
}

export function CommentSection({ postId, currentUserId, isAdmin }: CommentSectionProps) {
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; commentId: string }>({
    isOpen: false,
    commentId: '',
  })

  const loadComments = useCallback(async () => {
    setLoading(true)
    const result = await getComments(postId)
    if (!result.error) {
      setComments(result.data)
    }
    setLoading(false)
  }, [postId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const handleSubmitComment = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      setAlert({ isOpen: true, message: '댓글 내용을 입력해주세요.', type: 'error' })
      return
    }
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setAlert({ isOpen: true, message: `댓글은 ${COMMENT_MAX_LENGTH}자 이내로 입력해주세요.`, type: 'error' })
      return
    }

    setSubmitting(true)
    const result = await createComment({ post_id: postId, content: trimmed })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setContent('')
    setToast({ isOpen: true, message: '댓글이 등록되었습니다.', type: 'success' })
    loadComments()
  }

  const handleDeleteComment = async () => {
    const { commentId } = confirmDelete
    setConfirmDelete({ isOpen: false, commentId: '' })

    const result = await deleteComment(commentId, postId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '댓글이 삭제되었습니다.', type: 'success' })
    loadComments()
  }

  // 삭제 가능 여부: 본인 댓글 또는 ADMIN+
  const canDelete = (comment: PostComment): boolean => {
    if (!currentUserId) return false
    if (isAdmin) return true
    return comment.author_id === currentUserId
  }

  return (
    <section>
      <h2
        className="text-lg font-display mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        댓글 {comments.length > 0 && `(${comments.length})`}
      </h2>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <div className="h-3 w-20 rounded mb-2" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {comment.author?.name ?? '알 수 없음'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                {canDelete(comment) && (
                  <button
                    onClick={() => setConfirmDelete({ isOpen: true, commentId: comment.id })}
                    className="p-1 rounded hover:bg-(--border-color) transition-colors"
                    aria-label="댓글 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 댓글 작성 폼 */}
      <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
        {currentUserId ? (
          <div className="flex gap-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={COMMENT_MAX_LENGTH}
              rows={3}
              placeholder="댓글을 입력해주세요"
              aria-label="댓글 입력"
              className="flex-1 px-3 py-2.5 rounded-lg text-sm resize-none outline-none border border-(--border-color) focus:border-(--accent-color)"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={submitting || !content.trim()}
              className="self-end px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--bg-primary)',
              }}
              aria-label="댓글 등록"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            댓글을 작성하려면 로그인이 필요합니다.
          </p>
        )}
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
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, commentId: '' })}
        onConfirm={handleDeleteComment}
        title="댓글 삭제"
        message="이 댓글을 삭제하시겠습니까?"
        type="warning"
      />
    </section>
  )
}
