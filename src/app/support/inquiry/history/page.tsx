'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { InquiryCard } from '@/components/support/InquiryCard'
import { getMyInquiries } from '@/lib/support/actions'
import type { Inquiry } from '@/lib/support/types'
import { ChevronLeft, Plus, Inbox } from 'lucide-react'

export default function InquiryHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return

    async function load() {
      const result = await getMyInquiries()
      if (!result.error) {
        setInquiries(result.data)
      }
      setLoading(false)
    }
    load()
  }, [user, authLoading])

  // 비로그인 처리
  if (!authLoading && !user) {
    return (
      <>
        <Navigation />
        <main
          className="min-h-screen pt-20"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="max-w-6xl mx-auto px-6 py-12 text-center">
            <p className="mb-4" style={{ color: 'var(--text-primary)' }}>
              로그인이 필요합니다.
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

          <div className="flex items-center justify-between mb-8">
            <h1
              className="text-2xl font-display"
              style={{ color: 'var(--text-primary)' }}
            >
              내 문의 내역
            </h1>
            <Link
              href="/support/inquiry"
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              <Plus className="w-4 h-4" />
              새 문의
            </Link>
          </div>

          {/* 목록 */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-48 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                </div>
              ))}
            </div>
          ) : inquiries.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Inbox
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
                아직 문의 내역이 없습니다.
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                궁금한 점이 있으시면 문의를 남겨주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inquiries.map((inquiry) => (
                <InquiryCard key={inquiry.id} inquiry={inquiry} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
