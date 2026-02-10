'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { BracketMatch } from '@/components/admin/BracketManager/types'

interface UseMatchesRealtimeOptions {
  bracketConfigId: string
  onMatchUpdate?: (match: BracketMatch) => void
  enabled?: boolean
}

/**
 * Supabase Realtime을 사용하여 bracket_matches 테이블의 변경사항을 실시간으로 감지
 * 점수 입력, 코트 정보 변경 등이 즉시 화면에 반영됨
 */
export function useMatchesRealtime({
  bracketConfigId,
  onMatchUpdate,
  enabled = true,
}: UseMatchesRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  const subscribe = useCallback(() => {
    if (!enabled || !bracketConfigId) return

    const supabase = supabaseRef.current
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
          // 점수, 코트 정보, 상태 변경 등을 감지
          if (payload.new && onMatchUpdate) {
            const updatedMatch = payload.new as BracketMatch
            onMatchUpdate(updatedMatch)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime subscribed: bracket-matches:${bracketConfigId}`)
        } else if (status === 'CLOSED') {
          console.log(`Realtime unsubscribed: bracket-matches:${bracketConfigId}`)
        }
      })

    channelRef.current = channel
  }, [bracketConfigId, enabled, onMatchUpdate])

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    subscribe()
    return () => unsubscribe()
  }, [subscribe, unsubscribe])

  return { isSubscribed: channelRef.current !== null }
}
