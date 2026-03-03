'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SessionCard from './SessionCard'
import { getClubSessions } from '@/lib/clubs/session-actions'
import type { ClubSession } from '@/lib/clubs/types'

const PAGE_SIZE = 5

interface SessionListProps {
  clubId: string
  isOfficer: boolean
  onCreateSession: () => void
}

export default function SessionList({ clubId, isOfficer, onCreateSession }: SessionListProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<ClubSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // 초기 로드
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getClubSessions(clubId, { limit: PAGE_SIZE, offset: 0 }).then((data) => {
      if (cancelled) return
      setSessions(data)
      setHasMore(data.length === PAGE_SIZE)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [clubId])

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true)
    const data = await getClubSessions(clubId, { limit: PAGE_SIZE, offset: sessions.length })
    setSessions((prev) => [...prev, ...data])
    setHasMore(data.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [clubId, sessions.length])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-(--text-primary)">모임</h2>
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
        <div className="text-center py-12 text-(--text-muted) text-sm">불러오는 중...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-(--text-muted) text-sm glass-card rounded-xl">
          아직 모임이 없습니다.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isOfficer={isOfficer}
                onClick={() => router.push(`/clubs/${clubId}/sessions/${session.id}`)}
              />
            ))}
          </div>

          {/* 더 보기 */}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm font-medium text-(--text-muted) hover:text-(--text-primary) border border-(--border-color) rounded-xl transition-colors disabled:opacity-50"
            >
              {loadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
