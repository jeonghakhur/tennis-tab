/**
 * SEO 메타 전용 Supabase fetcher — React.cache()로 래핑하여
 * generateMetadata와 page 컴포넌트 간 중복 DB 쿼리 제거
 */
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type TournamentMeta = {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  location: string | null
  host: string | null
  poster_url: string | null
  organizer_name: string | null
}

export type ClubMeta = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  location: string | null
}

export type PostMeta = {
  id: string
  title: string
  content: string | null
  images: string[] | null
}

export const getTournamentForMeta = cache(async (id: string): Promise<TournamentMeta | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, title, start_date, end_date, location, host, poster_url, organizer_name')
    .eq('id', id)
    .single()
  return data
})

export const getClubForMeta = cache(async (id: string): Promise<ClubMeta | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, logo_url, location')
    .eq('id', id)
    .single()
  return data
})

export const getCommunityPostForMeta = cache(async (id: string): Promise<PostMeta | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts')
    .select('id, title, content, images')
    .eq('id', id)
    .single()
  return data
})
