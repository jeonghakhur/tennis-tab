'use client'

import { useEffect } from 'react'
import { touchLastSeen } from '@/lib/auth/actions'

// 세션당 1회 last_seen_at 갱신 — sessionStorage로 중복 호출 방지
export function LastSeenTracker() {
  useEffect(() => {
    const SESSION_KEY = 'lsat' // last_seen_at_touched
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
    touchLastSeen()
  }, [])

  return null
}
