'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Clock, Calendar, BookOpen } from 'lucide-react'
import { getCoachLessonCards, type CoachLessonCard } from '@/lib/lessons/actions'

export default function LessonsPage() {
  const [cards, setCards] = useState<CoachLessonCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCoachLessonCards().then(({ data }) => {
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
              레슨 신청
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            코치를 선택하고 원하는 시간에 레슨을 신청하세요.
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
              현재 모집 중인 레슨이 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <CoachCard key={card.coachId} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CoachCard({ card }: { card: CoachLessonCard }) {
  const router = useRouter()

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* 코치 프로필 */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {card.profileImageUrl ? (
            <img
              src={card.profileImageUrl}
              alt={`${card.coachName} 코치 프로필`}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            {card.coachName} 코치
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {card.sessionDurationMinutes}분 레슨
            </span>
          </div>
        </div>
      </div>

      {/* 요금 정보 */}
      {card.fees.length > 0 && (
        <div
          className="rounded-lg px-3.5 py-2.5 space-y-1"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {card.fees.map((fee) => (
            <div key={fee.label} className="flex justify-between items-center">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {fee.label}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {fee.amount.toLocaleString()}원
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 빈 슬롯 + 신청 버튼 */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {card.openSlotCount > 0
              ? `빈 슬롯 ${card.openSlotCount}개`
              : '빈 슬롯 없음'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/lessons/${card.programId}`)}
          disabled={card.openSlotCount === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: card.openSlotCount > 0 ? 'var(--accent-color)' : 'var(--bg-card-hover)',
            color: card.openSlotCount > 0 ? '#fff' : 'var(--text-muted)',
          }}
        >
          신청하기
        </button>
      </div>
    </div>
  )
}
