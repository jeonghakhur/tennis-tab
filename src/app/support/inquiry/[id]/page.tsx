'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { getMyInquiry } from '@/lib/support/actions'
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type Inquiry,
  type InquiryStatus,
} from '@/lib/support/types'
import { ChevronLeft, MessageCircle } from 'lucide-react'

const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
}

export default function InquiryDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user, loading: authLoading } = useAuth()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    async function load() {
      const result = await getMyInquiry(id)
      if (result.error) {
        setError(result.error)
      } else {
        setInquiry(result.data)
      }
      setLoading(false)
    }
    load()
  }, [id, user, authLoading])

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
            href="/support/inquiry/history"
            className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            내 문의 내역
          </Link>

          {loading ? (
            <div className="glass-card rounded-xl p-6 animate-pulse space-y-4">
              <div className="h-6 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-24 w-full rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          ) : error ? (
            <div className="glass-card rounded-xl p-6 text-center">
              <p style={{ color: 'var(--color-danger)' }}>{error}</p>
            </div>
          ) : inquiry ? (
            <div className="space-y-6">
              {/* 문의 내용 */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="secondary">
                    {INQUIRY_CATEGORY_LABELS[inquiry.category]}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[inquiry.status]}>
                    {INQUIRY_STATUS_LABELS[inquiry.status]}
                  </Badge>
                </div>

                <h1
                  className="text-xl font-display mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {inquiry.title}
                </h1>

                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  {new Date(inquiry.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                <div
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {inquiry.content}
                </div>
              </div>

              {/* 답변 */}
              {inquiry.reply_content ? (
                <div
                  className="glass-card rounded-xl p-6"
                  style={{ borderLeft: '4px solid var(--accent-color)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle
                      className="w-5 h-5"
                      style={{ color: 'var(--accent-color)' }}
                    />
                    <h2
                      className="font-display"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      답변
                    </h2>
                  </div>

                  <div
                    className="whitespace-pre-wrap text-sm leading-relaxed mb-3"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {inquiry.reply_content}
                  </div>

                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {inquiry.replier && (
                      <span>답변자: {inquiry.replier.name}</span>
                    )}
                    {inquiry.replied_at && (
                      <span>
                        {new Date(inquiry.replied_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-xl p-6 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    아직 답변이 등록되지 않았습니다.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </>
  )
}
