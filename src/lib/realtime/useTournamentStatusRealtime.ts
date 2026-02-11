'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface TournamentStatusPayload {
  id: string
  status: string
}

interface UseTournamentStatusRealtimeOptions {
  /** 구독할 대회 ID 목록 */
  tournamentIds: string[]
  /** 상태 변경 콜백 */
  onStatusChange: (tournamentId: string, newStatus: string) => void
  enabled?: boolean
}

/**
 * tournaments 테이블의 status 변경을 실시간으로 감지
 * - 프로필 페이지에서 대회 상태 변경 시 즉시 UI 반영
 */
export function useTournamentStatusRealtime({
  tournamentIds,
  onStatusChange,
  enabled = true,
}: UseTournamentStatusRealtimeOptions) {
  const callbackRef = useRef(onStatusChange)
  callbackRef.current = onStatusChange

  const channelRef = useRef<RealtimeChannel | null>(null)
  // tournamentIds를 문자열로 비교하여 불필요한 재구독 방지
  const idsKeyRef = useRef('')

  useEffect(() => {
    const idsKey = tournamentIds.sort().join(',')
    if (!enabled || tournamentIds.length === 0 || idsKey === idsKeyRef.current) return

    idsKeyRef.current = idsKey
    const supabase = createClient()

    // 이전 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel('tournament-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
        },
        (payload) => {
          const row = payload.new as TournamentStatusPayload
          // 내가 참가한 대회만 처리
          if (tournamentIds.includes(row.id)) {
            callbackRef.current(row.id, row.status)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      idsKeyRef.current = ''
    }
  }, [tournamentIds, enabled])
}
