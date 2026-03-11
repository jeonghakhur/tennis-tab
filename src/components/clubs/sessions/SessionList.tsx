'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SessionCard from './SessionCard'
import { getClubSessions } from '@/lib/clubs/session-actions'
import type { ClubSession } from '@/lib/clubs/types'

const PAGE_SIZE = 5

// 모듈 레벨 캐시: 뒤로가기 시 재조회 없이 즉시 렌더링
type SessionCacheEntry = { sessions: ClubSession[]; hasMore: boolean; refreshKey: number }
const sessionListCache = new Map<string, SessionCacheEntry>()

interface SessionListProps {
  clubId: string
  isOfficer: boolean
  onCreateSession: () => void
  /** 부모가 증가시키면 sessions 목록만 재조회 (club 전체 리로드 없이) */
  refreshKey?: number
}

export default function SessionList({ clubId, isOfficer, onCreateSession, refreshKey = 0 }: SessionListProps) {
  const router = useRouter()

  const cached = sessionListCache.get(clubId)
  // refreshKey가 바뀌었으면 캐시 무효화 (새 모임 생성 후)
  const validCache = cached && cached.refreshKey === refreshKey ? cached : null

  const [sessions, setSessions] = useState<ClubSession[]>(validCache?.sessions ?? [])
  const [loading, setLoading] = useState(!validCache)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(validCache?.hasMore ?? false)

  // 초기 로드 + refreshKey 변경 시 재조회
  useEffect(() => {
    // 유효한 캐시가 있으면 재조회 생략 (더보기로 확장된 목록 유지)
    const cached = sessionListCache.get(clubId)
    if (cached && cached.refreshKey === refreshKey) return

    let cancelled = false
    setLoading(true)
    getClubSessions(clubId, { limit: PAGE_SIZE, offset: 0 }).then((data) => {
      if (cancelled) return
      setSessions(data)
      setHasMore(data.length === PAGE_SIZE)
      setLoading(false)
      sessionListCache.set(clubId, { sessions: data, hasMore: data.length === PAGE_SIZE, refreshKey })
    })
    return () => { cancelled = true }
  }, [clubId, refreshKey])

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true)
    const data = await getClubSessions(clubId, { limit: PAGE_SIZE, offset: sessions.length })
    const merged = [...sessions, ...data]
    const more = data.length === PAGE_SIZE
    setSessions(merged)
    setHasMore(more)
    setLoadingMore(false)
    sessionListCache.set(clubId, { sessions: merged, hasMore: more, refreshKey })
  }, [clubId, sessions, refreshKey])

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
