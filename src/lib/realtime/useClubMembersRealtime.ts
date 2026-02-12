'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ClubMember } from '@/lib/clubs/types'

interface UseClubMembersRealtimeOptions {
  clubId: string
  /** 회원 목록 전체를 갱신하는 setter */
  onMembersChange: React.Dispatch<React.SetStateAction<ClubMember[]>>
  enabled?: boolean
}

/**
 * club_members 테이블의 변경사항을 실시간 감지하여 로컬 상태에 반영.
 *
 * - INSERT: 새 회원 추가
 * - UPDATE: 기존 회원 정보 갱신 (역할 변경, 상태 변경 등)
 * - DELETE: 회원 삭제 (거절 등)
 */
export function useClubMembersRealtime({
  clubId,
  onMembersChange,
  enabled = true,
}: UseClubMembersRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  // 디바운스: 짧은 시간 내 다수 이벤트 발생 시 한 번만 처리
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled || !clubId) return

    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`club-members:${clubId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_members',
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            // UPDATE: 해당 row만 교체
            const updated = payload.new as ClubMember
            onMembersChange((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            )
          } else if (payload.eventType === 'INSERT' && payload.new) {
            // INSERT: 새 회원 추가
            const inserted = payload.new as ClubMember
            onMembersChange((prev) => {
              // 중복 방지
              if (prev.some((m) => m.id === inserted.id)) return prev
              return [...prev, inserted]
            })
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // DELETE: 회원 제거
            const deleted = payload.old as { id: string }
            // 디바운스: 다수 DELETE 동시 발생 시 (ex. 클럽 삭제)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              onMembersChange((prev) => prev.filter((m) => m.id !== deleted.id))
              debounceRef.current = null
            }, 100)
          }
        }
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
  }, [clubId, enabled, onMembersChange])
}
