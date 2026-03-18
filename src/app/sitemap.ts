import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennis-tab.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                  changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/tournaments`, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/clubs`,       changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/community`,   changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/lessons`,     changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/guide`,       changeFrequency: 'monthly', priority: 0.5 },
  ]

  const supabase = createAdminClient()

  // 공개 대회 (DRAFT 제외)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, updated_at')
    .neq('status', 'DRAFT')
    .order('updated_at', { ascending: false })
    .limit(500)

  // 클럽
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  // 커뮤니티 포스트
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  return [
    ...staticPages,
    ...(tournaments ?? []).map((t) => ({
      url: `${BASE}/tournaments/${t.id}`,
      lastModified: t.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...(clubs ?? []).map((c) => ({
      url: `${BASE}/clubs/${c.id}`,
      lastModified: c.updated_at ?? undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(posts ?? []).map((p) => ({
      url: `${BASE}/community/${p.id}`,
      lastModified: p.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
