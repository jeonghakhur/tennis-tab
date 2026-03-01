'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SessionCard from './SessionCard'
import { getClubSessions } from '@/lib/clubs/session-actions'
import type { ClubSession, ClubSessionStatus } from '@/lib/clubs/types'

type FilterTab = 'upcoming' | 'completed'

const FILTER_MAP: Record<FilterTab, ClubSessionStatus[]> = {
  upcoming: ['OPEN', 'CLOSED'],
  completed: ['COMPLETED', 'CANCELLED'],
}

interface SessionListProps {
  clubId: string
  isOfficer: boolean
  onCreateSession: () => void
}

export default function SessionList({ clubId, isOfficer, onCreateSession }: SessionListProps) {
  const router = useRouter()
  // 탭별 캐시: 한 번 로드한 데이터는 재요청 없이 재사용
  const [cache, setCache] = useState<Partial<Record<FilterTab, ClubSession[]>>>({})
  const [filter, setFilter] = useState<FilterTab>('upcoming')
  const [loading, setLoading] = useState(true)

  const sessions = cache[filter] ?? []

  const fetchSessions = useCallback(async (tab: FilterTab, force = false) => {
    if (!force && cache[tab]) return // 캐시 히트
    setLoading(true)
    const data = await getClubSessions(clubId, {
      status: FILTER_MAP[tab],
      limit: 20,
    })
    setCache(prev => ({ ...prev, [tab]: data }))
    setLoading(false)
  }, [clubId, cache])

  useEffect(() => {
    fetchSessions(filter)
  }, [filter, clubId])

  return (
    <div className="space-y-4">
      {/* 헤더: 필터 탭 + 생성 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-(--bg-secondary)">
          {(['upcoming', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === tab
                  ? 'bg-(--accent-color) text-(--bg-primary) font-semibold'
                  : 'text-(--text-muted) hover:text-(--text-primary)'
              }`}
            >
              {tab === 'upcoming' ? '예정' : '지난 모임'}
            </button>
          ))}
        </div>

        {isOfficer && (
          <button
            onClick={onCreateSession}
            className="px-3 py-1.5 text-sm rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold hover:opacity-90 transition-opacity"
          >
            + 모임 생성
          </button>
        )}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">
          불러오는 중...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">
          {filter === 'upcoming' ? '예정된 모임이 없습니다.' : '지난 모임이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() =>
                router.push(`/clubs/${clubId}/sessions/${session.id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
