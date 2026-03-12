'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseEntriesRealtimeOptions {
  tournamentId: string
  /** 엔트리 변경 시 호출되는 콜백 (router.refresh 또는 refreshEntries) */
  onEntryChange: () => void
  enabled?: boolean
}

/**
 * tournament_entries 테이블의 변경사항을 실시간 감지.
 *
 * - 어드민: onEntryChange → router.refresh()
 * - 프론트: onEntryChange → refreshEntries() (로컬 상태 갱신)
 *
 * 짧은 시간 내 연속 이벤트를 디바운스(300ms)로 묶어서 처리.
 */
export function useEntriesRealtime({
  tournamentId,
  onEntryChange,
  enabled = true,
}: UseEntriesRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 콜백 최신값을 ref로 유지 (stale closure 방지)
  const onEntryChangeRef = useRef(onEntryChange)
  onEntryChangeRef.current = onEntryChange

  useEffect(() => {
    if (!enabled || !tournamentId) return

    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const handleChange = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onEntryChangeRef.current()
        debounceRef.current = null
      }, 300)
    }

    const channel = supabase
      .channel(`tournament-entries:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_entries',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        handleChange,
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [tournamentId, enabled])
}
