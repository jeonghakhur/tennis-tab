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
  /** UPDATE 이벤트 — 기존 매치의 점수/상태 변경 */
  onMatchUpdate?: (payload: RealtimeMatchPayload) => void
  /** INSERT/DELETE 이벤트 — 대진표 구조 변경 시 전체 refetch 트리거 */
  onReload?: () => void
  enabled?: boolean
}

/**
 * Supabase Realtime을 사용하여 bracket_matches 테이블의 변경사항을 실시간으로 감지
 *
 * - UPDATE: onMatchUpdate로 기존 상태와 병합 (JOIN 데이터 보존)
 * - INSERT/DELETE: onReload로 전체 데이터 refetch (대진표 생성/삭제)
 */
export function useMatchesRealtime({
  bracketConfigId,
  onMatchUpdate,
  onReload,
  enabled = true,
}: UseMatchesRealtimeOptions) {
  // 콜백을 ref로 관리하여 재구독 방지
  const updateRef = useRef(onMatchUpdate)
  updateRef.current = onMatchUpdate

  const reloadRef = useRef(onReload)
  reloadRef.current = onReload

  const channelRef = useRef<RealtimeChannel | null>(null)

  // INSERT/DELETE 이벤트 디바운스 (대진표 삭제 시 여러 DELETE가 한꺼번에 발생)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          if (payload.eventType === 'UPDATE' && payload.new) {
            // 점수/상태 변경 → 즉시 merge
            updateRef.current?.(payload.new as RealtimeMatchPayload)
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            // 대진표 구조 변경 → 디바운스 후 전체 refetch
            if (reloadTimerRef.current) {
              clearTimeout(reloadTimerRef.current)
            }
            reloadTimerRef.current = setTimeout(() => {
              reloadRef.current?.()
              reloadTimerRef.current = null
            }, 300)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current)
        reloadTimerRef.current = null
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [bracketConfigId, enabled])
}
