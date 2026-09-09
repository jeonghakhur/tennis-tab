import type { JWK } from '@supabase/supabase-js'

/**
 * Supabase Auth JWKS(공개키 세트) 모듈 레벨 캐시
 *
 * `auth.getUser()`는 매 호출마다 Auth 서버(원격 리전)에 왕복하지만,
 * `auth.getClaims()`는 JWKS로 JWT 서명을 로컬에서 검증한다.
 * 다만 요청마다 새 Supabase 클라이언트를 만들기 때문에 클라이언트 내부 JWKS 캐시는 매번 비어 있어
 * JWKS를 다시 받아오게 된다 → 이 모듈에서 서버리스 인스턴스(또는 엣지 isolate) 수명 동안 캐시해 전달한다.
 *
 * 프로젝트가 대칭키(HS256)로 토큰을 서명하는 경우 getClaims는 내부적으로 getUser로 fallback하므로
 * 안전성은 동일하게 유지된다.
 */
type Jwks = { keys: JWK[] }

const JWKS_TTL_MS = 10 * 60 * 1000 // 10분

let cachedJwks: Jwks | null = null
let cachedAt = 0
let inflight: Promise<Jwks | null> | null = null

export async function getCachedJwks(): Promise<Jwks | null> {
  const now = Date.now()
  if (cachedJwks && now - cachedAt < JWKS_TTL_MS) return cachedJwks
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !anonKey) return null

      const res = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
        headers: { apikey: anonKey },
        cache: 'no-store',
      })
      if (!res.ok) return null

      const data = (await res.json()) as Jwks
      if (!data.keys?.length) return null

      cachedJwks = data
      cachedAt = Date.now()
      return data
    } catch {
      // 실패 시 null → getClaims가 자체 fetch/getUser fallback으로 처리
      return null
    } finally {
      inflight = null
    }
  })()

  return inflight
}
