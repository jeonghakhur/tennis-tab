import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClubDetailTabs } from '@/components/clubs/ClubDetailTabs'
import type { Club, ClubMember } from '@/lib/clubs/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MyClubDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const admin = createAdminClient()

  // 클럽 임원 여부 확인
  const { data: membership } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', id)
    .eq('user_id', user.id)
    .in('role', ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'])
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!membership) redirect('/my/clubs')

  // 클럽 정보 조회
  const { data: club } = await admin
    .from('clubs')
    .select(`
      *,
      associations:association_id (name)
    `)
    .eq('id', id)
    .single()

  if (!club) notFound()

  // 회원 목록 조회 (REMOVED/LEFT 포함 — 클라이언트에서 필터링)
  const { data: members } = await admin
    .from('club_members')
    .select('*')
    .eq('club_id', id)
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  // 협회 목록: 클럽 임원은 자신의 클럽 협회만 표시
  const associations: { id: string; name: string }[] = []
  if (club.association_id) {
    const { data: assoc } = await admin
      .from('associations')
      .select('id, name')
      .eq('id', club.association_id)
      .single()
    if (assoc) associations.push(assoc)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/my/clubs"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            {club.name}
          </h1>
          <p className="text-(--text-secondary) mt-1">
            {(club.associations as { name: string } | null)?.name || '독립 클럽'}
            {club.city && ` · ${[club.city, club.district].filter(Boolean).join(' ')}`}
          </p>
        </div>
      </div>

      <ClubDetailTabs
        club={club as Club}
        initialMembers={(members || []) as ClubMember[]}
        associations={associations}
        isSystemAdmin={false}
        backUrl="/my/clubs"
      />
    </div>
  )
}
