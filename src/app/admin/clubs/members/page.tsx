import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getAllClubMembers } from '@/lib/clubs/actions'
import { AllMembersSearch } from '@/components/clubs/AllMembersSearch'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function AllMembersPage({ searchParams }: Props) {
  const { q } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinimumRole(profile?.role, 'MANAGER')) redirect('/admin')

  const { data: members } = await getAllClubMembers()

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
            전체 회원 검색
          </h1>
          <p className="text-(--text-secondary) mt-1">
            총 {members.length}명
          </p>
        </div>
      </div>

      <AllMembersSearch initialMembers={members} initialQuery={q ?? ''} />
    </div>
  )
}
