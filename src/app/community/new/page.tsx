'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { createPost } from '@/lib/community/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { PostForm } from '@/components/community/PostForm'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ArrowLeft } from 'lucide-react'
import type { CreatePostInput } from '@/lib/community/types'
import type { UserRole } from '@/lib/supabase/types'

export default function NewPostPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const isAdminUser = hasMinimumRole(profile?.role as UserRole, 'ADMIN')
  const canWrite = hasMinimumRole(profile?.role as UserRole, 'MANAGER')

  // 권한 체크: 로그인 안 됐거나 MANAGER 미만이면 리다이렉트
  useEffect(() => {
    if (authLoading) return
    if (!user || !canWrite) {
      router.replace('/community')
    }
  }, [authLoading, user, canWrite, router])

  const handleSubmit = async (data: CreatePostInput) => {
    setSubmitting(true)
    const result = await createPost(data)
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    if (result.data) {
      setToast({ isOpen: true, message: '게시글이 작성되었습니다.', type: 'success' })
      setTimeout(() => router.push(`/community/${result.data!.id}`), 500)
    }
  }

  // 로딩/권한 체크 중
  if (authLoading || !canWrite) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-48 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>

          <h1
            className="text-2xl font-display mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            글쓰기
          </h1>

          <div className="glass-card rounded-xl p-6">
            <PostForm
              mode="create"
              onSubmit={handleSubmit}
              isAdmin={isAdminUser}
              isSubmitting={submitting}
            />
          </div>
        </div>
      </main>

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
