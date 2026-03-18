/**
 * JSON-LD 구조화 데이터 빌더
 * 구글 리치 결과(Rich Results) 노출을 위한 schema.org 마크업
 */
import type { TournamentMeta, ClubMeta, PostMeta } from './fetchers'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'

/**
 * 대회 상세 → SportsEvent
 * https://schema.org/SportsEvent
 */
export function buildSportsEventJsonLd(t: TournamentMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: t.title,
    ...(t.start_date && { startDate: t.start_date }),
    ...(t.end_date && { endDate: t.end_date }),
    ...(t.location && {
      location: {
        '@type': 'Place',
        name: t.location,
      },
    }),
    ...(t.host && {
      organizer: {
        '@type': 'Organization',
        name: t.host,
      },
    }),
    url: `${SITE_URL}/tournaments/${t.id}`,
    sport: '테니스',
  }
}

/**
 * 클럽 상세 → SportsOrganization
 * https://schema.org/SportsOrganization
 */
export function buildSportsOrgJsonLd(c: ClubMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: c.name,
    ...(c.description && { description: c.description.slice(0, 200) }),
    ...(c.location && { address: c.location }),
    ...(c.logo_url && {
      logo: {
        '@type': 'ImageObject',
        url: c.logo_url,
      },
    }),
    url: `${SITE_URL}/clubs/${c.id}`,
    sport: '테니스',
  }
}

/**
 * 커뮤니티 포스트 → Article
 * https://schema.org/Article
 */
export function buildArticleJsonLd(p: PostMeta): object {
  // HTML 태그 제거 후 description 정제 (XSS 방지 목적이 아닌 텍스트 추출용)
  const plainText = (p.content ?? '').replace(/<[^>]+>/g, '').slice(0, 200)

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    ...(plainText && { description: plainText }),
    ...(p.images?.[0] && {
      image: {
        '@type': 'ImageObject',
        url: p.images[0],
      },
    }),
    url: `${SITE_URL}/community/${p.id}`,
  }
}
