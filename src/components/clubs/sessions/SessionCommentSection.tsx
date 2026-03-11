'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Send } from 'lucide-react'
import { getSessionComments, createSessionComment, deleteSessionComment } from '@/lib/clubs/session-actions'
import { AlertDialog, Toast, ConfirmDialog } from '@/components/common/AlertDialog'
import type { ClubSessionComment } from '@/lib/clubs/types'

const COMMENT_MAX_LENGTH = 1000

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

interface SessionCommentSectionProps {
  sessionId: string
  /** 로그인한 사용자의 auth.uid (댓글 작성 가능 여부 판단용) */
  currentUserId?: string
  /** 임원 여부 — true면 모든 댓글 삭제 가능 */
  isOfficer?: boolean
}

export default function SessionCommentSection({
  sessionId,
  currentUserId,
  isOfficer = false,
}: SessionCommentSectionProps) {
  const [comments, setComments] = useState<ClubSessionComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; commentId: string }>({
    isOpen: false,
    commentId: '',
  })

  const loadComments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const result = await getSessionComments(sessionId)
    if (!result.error) setComments(result.data)
    if (!silent) setLoading(false)
  }, [sessionId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const handleSubmit = async () => {
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
    const result = await createSessionComment(sessionId, trimmed)
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setContent('')
    loadComments(true)
  }

  const handleDelete = async () => {
    const { commentId } = confirmDelete
    setConfirmDelete({ isOpen: false, commentId: '' })

    const result = await deleteSessionComment(commentId, sessionId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '댓글이 삭제되었습니다.', type: 'success' })
    loadComments(true)
  }

  const canDelete = (comment: ClubSessionComment): boolean => {
    if (!currentUserId) return false
    return isOfficer || comment.author_id === currentUserId
  }

  return (
    <section className="glass-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-(--text-primary) mb-4">
        댓글{comments.length > 0 && ` (${comments.length})`}
      </h3>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="animate-pulse p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <div className="h-3 w-20 rounded mb-2" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-center py-6 text-(--text-muted)">
          아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-(--text-primary)">
                    {comment.author?.name ?? '알 수 없음'}
                  </span>
                  <span className="text-xs text-(--text-muted)">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                {canDelete(comment) && (
                  <button
                    onClick={() => setConfirmDelete({ isOpen: true, commentId: comment.id })}
                    className="p-1 rounded hover:bg-(--border-color) transition-colors"
                    aria-label="댓글 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-(--text-muted)" />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap text-(--text-secondary)">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 댓글 작성 폼 */}
      <div className={`pt-3 border-t border-(--border-color)${comments.length === 0 ? ' mt-0' : ''}`}>
        {currentUserId ? (
          <div className="flex gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={COMMENT_MAX_LENGTH}
              rows={2}
              placeholder="댓글을 입력해주세요"
              aria-label="댓글 입력"
              className="flex-1 h-14 px-3 py-2 rounded-lg text-sm resize-none outline-none border border-(--border-color) focus:border-(--accent-color)"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              onKeyDown={(e) => {
                // Ctrl/Cmd + Enter 로 제출
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="w-14 h-14 shrink-0 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-(--accent-color) text-(--bg-primary) flex items-center justify-center"
              aria-label="댓글 등록"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-center py-3 text-(--text-muted)">
            댓글을 작성하려면 로그인이 필요합니다.
          </p>
        )}
      </div>

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
        onConfirm={handleDelete}
        title="댓글 삭제"
        message="이 댓글을 삭제하시겠습니까?"
        type="warning"
      />
    </section>
  )
}
