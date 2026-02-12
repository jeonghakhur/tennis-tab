/** Rate Limit 엔트리 */
interface RateLimitEntry {
  count: number
  resetAt: number // Date.now() + WINDOW_MS
}

/** 인메모리 Rate Limit 저장소 (서버 재시작 시 초기화) */
const rateLimitMap = new Map<string, RateLimitEntry>()

/** 윈도우 크기: 1분 */
const WINDOW_MS = 60_000

const LIMITS = {
  anonymous: 10,     // 비회원: 10회/분
  authenticated: 30, // 회원: 30회/분
} as const

/** Rate limit 확인. 초과 시 { limited: true, retryAfter } 반환 */
export function checkRateLimit(
  key: string,
  isAuthenticated: boolean,
): { limited: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  const limit = isAuthenticated ? LIMITS.authenticated : LIMITS.anonymous

  // 윈도우 만료 → 리셋
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { limited: false }
  }

  // 한도 내
  if (entry.count < limit) {
    entry.count += 1
    return { limited: false }
  }

  // 한도 초과
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
  return { limited: true, retryAfter }
}
