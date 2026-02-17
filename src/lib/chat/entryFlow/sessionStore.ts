import type { EntryFlowSession } from './types'

/** 인메모리 세션 저장소 (서버 재시작 시 초기화 — 짧은 세션이므로 허용) */
const sessionMap = new Map<string, EntryFlowSession>()

/** 세션 TTL: 10분 */
const SESSION_TTL_MS = 10 * 60 * 1000

/** 마지막 정리 시각 */
let lastCleanup = Date.now()

/** 정리 주기: 5분 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/** 만료된 세션 일괄 정리 */
function cleanupExpired(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, session] of sessionMap) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessionMap.delete(key)
    }
  }
}

/** 세션 조회 (만료 시 null 반환 + 삭제) */
export function getSession(userId: string): EntryFlowSession | null {
  cleanupExpired()

  const session = sessionMap.get(userId)
  if (!session) return null

  // TTL 초과 → 삭제 (마지막 활동 기준)
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessionMap.delete(userId)
    return null
  }

  return session
}

/** 세션 저장/업데이트 */
export function setSession(userId: string, session: EntryFlowSession): void {
  session.updatedAt = Date.now()
  sessionMap.set(userId, session)
}

/** 세션 삭제 */
export function deleteSession(userId: string): void {
  sessionMap.delete(userId)
}
