'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { AlertDialog } from '@/components/common/AlertDialog'
import { Toast } from '@/components/common/Toast'
import { InquiryForm } from '@/components/support/InquiryForm'
import { createInquiry } from '@/lib/support/actions'
import type { CreateInquiryInput } from '@/lib/support/types'
import { ChevronLeft } from 'lucide-react'

export default function InquiryCreatePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  const handleSubmit = async (data: CreateInquiryInput) => {
    setSubmitting(true)
    try {
      const result = await createInquiry(data)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      setToast({ isOpen: true, message: '문의가 접수되었습니다.', type: 'success' })
      // Toast 표시 후 이동
      setTimeout(() => {
        router.push('/support/inquiry/history')
      }, 1000)
    } finally {
      setSubmitting(false)
    }
  }

  // 비로그인 처리
  if (!loading && !user) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="max-w-6xl mx-auto px-6 py-12 text-center">
            <p className="mb-4" style={{ color: 'var(--text-primary)' }}>
              문의를 남기려면 로그인이 필요합니다.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              로그인
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            고객센터
          </Link>

          <h1
            className="text-2xl font-display mb-8"
            style={{ color: 'var(--text-primary)' }}
          >
            1:1 문의하기
          </h1>

          <div className="glass-card rounded-xl p-6">
            <InquiryForm onSubmit={handleSubmit} isSubmitting={submitting} />
          </div>
        </div>
      </main>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}
