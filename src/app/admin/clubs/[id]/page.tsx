import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClubDetailTabs } from '@/components/clubs/ClubDetailTabs'
import type { Club, ClubMember } from '@/lib/clubs/types'
import { decryptProfile } from '@/lib/crypto/profileCrypto'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function ClubDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams
  const listUrl = q ? `/admin/clubs?q=${encodeURIComponent(q)}` : '/admin/clubs'
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

  // 권한 확인: 시스템 ADMIN 이상이거나 클럽 OWNER/ADMIN/MATCH_DIRECTOR
  if (!hasMinimumRole(profile?.role, 'ADMIN')) {
    const { data: membership } = await admin
      .from('club_members')
      .select('role')
      .eq('club_id', id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'])
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!membership) redirect('/admin/clubs')
  }

  // 회원 목록 조회 (REMOVED/LEFT 포함 — 클라이언트에서 필터링)
  const { data: members } = await admin
    .from('club_members')
    .select('*')
    .eq('club_id', id)
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  // club_members.phone에 암호화된 값이 저장된 경우 복호화
  // (profiles.phone은 암호화 저장 — inviteMember 버그로 인해 암호문이 복사된 케이스 대응)
  const registeredUserIds = (members || [])
    .filter((m) => m.user_id)
    .map((m) => m.user_id as string)

  let profilePhoneMap: Record<string, string | null> = {}
  if (registeredUserIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, phone')
      .in('id', registeredUserIds)
    profilePhoneMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, decryptProfile(p).phone ?? null])
    )
  }

  const membersWithPhone = (members || []).map((m) =>
    m.user_id ? { ...m, phone: profilePhoneMap[m.user_id] ?? m.phone } : m
  )

  // 협회 목록 fetch (시스템 관리자: 전체, 기타: 자신의 협회만)
  const isSystemAdmin = hasMinimumRole(profile?.role, 'ADMIN')
  let associations: { id: string; name: string }[] = []

  if (isSystemAdmin) {
    const { data: assocData } = await admin.from('associations').select('id, name').order('name')
    associations = assocData || []
  } else {
    const { data: mgr } = await admin
      .from('association_managers')
      .select('association_id, associations:association_id(id, name)')
      .eq('user_id', user.id)
      .maybeSingle()
    if (mgr?.associations) {
      associations = [mgr.associations as unknown as { id: string; name: string }]
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={listUrl}
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
        initialMembers={membersWithPhone as ClubMember[]}
        associations={associations}
        isSystemAdmin={isSystemAdmin}
      />
    </div>
  )
}
