'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/** Realtime payload에서 받는 raw DB row (JOIN 데이터 없음) */
export interface RealtimeMatchPayload {
  id: string
  bracket_config_id: string
  phase: string
  group_id: string | null
  bracket_position: number | null
  round_number: number | null
  match_number: number
  team1_entry_id: string | null
  team2_entry_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_entry_id: string | null
  next_match_id: string | null
  next_match_slot: number | null
  loser_next_match_id: string | null
  loser_next_match_slot: number | null
  status: string
  scheduled_time: string | null
  completed_at: string | null
  notes: string | null
  sets_detail: unknown
  court_location: string | null
  court_number: string | null
  created_at: string
  updated_at: string
}

interface UseMatchesRealtimeOptions {
  bracketConfigId: string
  onMatchUpdate?: (payload: RealtimeMatchPayload) => void
  enabled?: boolean
}

/**
 * Supabase Realtime을 사용하여 bracket_matches 테이블의 변경사항을 실시간으로 감지
 *
 * 주의: Realtime payload에는 JOIN 데이터(team1, team2 이름 등)가 포함되지 않음
 * → onMatchUpdate에서 기존 상태와 병합해야 함
 */
export function useMatchesRealtime({
  bracketConfigId,
  onMatchUpdate,
  enabled = true,
}: UseMatchesRealtimeOptions) {
  // 콜백을 ref로 관리하여 재구독 방지
  const callbackRef = useRef(onMatchUpdate)
  callbackRef.current = onMatchUpdate

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !bracketConfigId) return

    const supabase = createClient()

    // 이전 채널이 있으면 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`bracket-matches:${bracketConfigId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bracket_matches',
          filter: `bracket_config_id=eq.${bracketConfigId}`,
        },
        (payload) => {
          if (payload.new && callbackRef.current) {
            callbackRef.current(payload.new as RealtimeMatchPayload)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [bracketConfigId, enabled])
}
