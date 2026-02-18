'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getPost, updatePost } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { PostForm } from '@/components/community/PostForm'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ArrowLeft } from 'lucide-react'
import type { Post, CreatePostInput } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const isAdminUser = hasMinimumRole(profile?.role as UserRole, 'ADMIN')

  useEffect(() => {
    if (!id || authLoading) return
    loadPost()
  }, [id, authLoading])

  const loadPost = async () => {
    setLoading(true)
    const result = await getPost(id)
    if (result.data) {
      // 본인 글인지 확인 (ADMIN+ 는 통과)
      if (!isAdminUser && user && result.data.author_id !== user.id) {
        router.replace(`/community/${id}`)
        return
      }
      setPost(result.data)
    } else {
      router.replace('/community')
    }
    setLoading(false)
  }

  const handleSubmit = async (data: CreatePostInput) => {
    setSubmitting(true)
    const result = await updatePost(id, {
      category: data.category,
      title: data.title,
      content: data.content,
      attachments: data.attachments,
    })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '게시글이 수정되었습니다.', type: 'success' })
    setTimeout(() => router.push(`/community/${id}`), 500)
  }

  if (loading || authLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-48 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
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
      <div className="max-w-screen-xl mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href={`/community/${id}`}
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Link>

          <h1
            className="text-2xl font-display mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            글 수정
          </h1>

          <div className="glass-card rounded-xl p-6">
            <PostForm
              mode="edit"
              initialData={{
                category: post.category,
                title: post.title,
                content: post.content,
                attachments: post.attachments,
              }}
              onSubmit={handleSubmit}
              isAdmin={isAdminUser}
              isSubmitting={submitting}
            />
          </div>
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
    </>
  )
}
