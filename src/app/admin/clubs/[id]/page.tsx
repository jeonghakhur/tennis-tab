import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClubDetailTabs } from '@/components/clubs/ClubDetailTabs'
import type { Club, ClubMember } from '@/lib/clubs/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinimumRole(profile?.role, 'MANAGER')) redirect('/admin')

  const admin = createAdminClient()

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

  // 권한 확인: SUPER_ADMIN이거나 클럽 OWNER/ADMIN
  if (profile?.role !== 'SUPER_ADMIN') {
    const { data: membership } = await admin
      .from('club_members')
      .select('role')
      .eq('club_id', id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!membership) redirect('/admin/clubs')
  }

  // 회원 목록 조회
  const { data: members } = await admin
    .from('club_members')
    .select('*')
    .eq('club_id', id)
    .in('status', ['ACTIVE', 'PENDING', 'INVITED'])
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clubs"
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
      />
    </div>
  )
}
