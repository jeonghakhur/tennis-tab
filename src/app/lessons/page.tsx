'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Clock, Award, BookOpen, ChevronRight } from 'lucide-react'
import { getPublicCoaches, type PublicCoachCard } from '@/lib/coaches/actions'

/** bio 텍스트에서 첫 줄 또는 50자 잘라내기 */
function truncateBio(bio: string | null, maxLen = 50): string {
  if (!bio) return ''
  const firstLine = bio.split('\n')[0]
  if (firstLine.length <= maxLen) return firstLine
  return firstLine.substring(0, maxLen) + '…'
}

/** 자격증 뱃지 (최대 2개) */
function CertBadges({ certs }: { certs: string[] }) {
  if (certs.length === 0) return null
  const visible = certs.slice(0, 2)
  const remaining = certs.length - 2

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((cert) => (
        <span
          key={cert}
          className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
        >
          <Award className="w-3 h-3" />
          {cert}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          +{remaining}
        </span>
      )}
    </div>
  )
}

function CoachProfileCard({ card }: { card: PublicCoachCard }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push(`/lessons/coaches/${card.id}`)}
      className="w-full text-left rounded-xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        // @ts-expect-error CSS variable
        '--tw-ring-color': 'var(--accent-color)',
      }}
      aria-label={`${card.name} 코치 상세 보기`}
    >
      {/* 코치 프로필 */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {card.profileImageUrl ? (
            <img
              src={card.profileImageUrl}
              alt={`${card.name} 코치 프로필`}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <User className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            {card.name} 코치
          </h3>
          {card.bio && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
              {truncateBio(card.bio)}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* 자격증 뱃지 */}
      <CertBadges certs={card.certifications} />

      {/* 하단: 요금 요약 + 레슨 시간 */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
        {card.programId ? (
          <>
            <div className="flex flex-col gap-0.5">
              {card.feeSummary && (
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {card.feeSummary}
                </span>
              )}
              {card.sessionDurationMinutes && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="w-3 h-3" />
                  {card.sessionDurationMinutes}분 레슨
                </span>
              )}
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: card.openSlotCount > 0 ? 'var(--color-success-subtle)' : 'var(--bg-card-hover)',
                color: card.openSlotCount > 0 ? 'var(--color-success)' : 'var(--text-muted)',
              }}
            >
              {card.openSlotCount > 0 ? `빈 슬롯 ${card.openSlotCount}개` : '빈 슬롯 없음'}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            지금 신청 가능한 레슨이 없습니다.
          </span>
        )}
      </div>
    </button>
  )
}

export default function LessonsPage() {
  const [cards, setCards] = useState<PublicCoachCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicCoaches().then(({ data }) => {
      setCards(data)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-content mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
            <h1 className="text-2xl font-display" style={{ color: 'var(--text-primary)' }}>
              레슨 안내
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            코치를 선택하고 레슨 정보를 확인하세요.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              현재 등록된 코치가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <CoachProfileCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
