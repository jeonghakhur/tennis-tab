'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface BracketConfigPayload {
  id: string
  active_phase: string | null
  active_round: number | null
}

interface UseBracketConfigRealtimeOptions {
  configIds: string[]
  onConfigChange: (configId: string, activePhase: string | null, activeRound: number | null) => void
  enabled?: boolean
}

/**
 * bracket_configs 테이블의 active_phase / active_round 변경을 실시간 감지
 * - 관리자가 라운드 진행 토글 시 참가자 화면에 즉시 반영
 */
export function useBracketConfigRealtime({
  configIds,
  onConfigChange,
  enabled = true,
}: UseBracketConfigRealtimeOptions) {
  const callbackRef = useRef(onConfigChange)
  callbackRef.current = onConfigChange

  // supabase 클라이언트를 ref로 유지 — cleanup 시점과 동일 인스턴스 보장
  const supabaseRef = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const idsKeyRef = useRef('')

  // 배열 참조 변경에 의한 불필요한 effect 재진입 방지 — 문자열 key로 비교
  const idsKey = [...configIds].sort().join(',')

  useEffect(() => {
    const supabase = supabaseRef.current

    // enabled=false 또는 빈 목록이면 기존 채널 정리 후 종료
    if (!enabled || configIds.length === 0) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        idsKeyRef.current = ''
      }
      return
    }

    // 구독 대상이 동일하면 재구독 불필요
    if (idsKey === idsKeyRef.current) return

    idsKeyRef.current = idsKey

    // 이전 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    // configIds 조합으로 고유 채널명 생성 (다중 인스턴스 충돌 방지)
    const channel = supabase
      .channel(`bracket-config-active:${idsKey}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bracket_configs',
        },
        (payload) => {
          const row = payload.new as BracketConfigPayload
          if (configIds.includes(row.id)) {
            callbackRef.current(row.id, row.active_phase, row.active_round)
          }
        }
      )
      .subscribe((status, err) => {
        // 구독 실패 시 (테이블이 publication에 없는 경우 등) AbortError 억제
        if (err) {
          console.warn('[BracketConfigRealtime] 구독 오류 (마이그레이션 미적용 가능성):', err)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      idsKeyRef.current = ''
    }
  }, [idsKey, enabled])
}
