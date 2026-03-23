import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptProfile } from '@/lib/crypto/profileCrypto'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { UserDetailView, type ClubMembership, type TournamentEntry, type Enrollment } from '@/components/admin/UserDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // ADMIN 이상만 접근 가능
  if (!isAdmin(currentProfile?.role)) redirect('/admin')

  const admin = createAdminClient()

  // 대상 프로필 조회
  const { data: rawProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!rawProfile) notFound()

  const profile = decryptProfile(rawProfile)

  // 클럽 가입 현황
  const { data: clubMemberships } = await admin
    .from('club_members')
    .select('id, role, status, joined_at, created_at, clubs:club_id(id, name)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  // 레슨 수강 현황 (lesson_enrollments → lesson_programs → coaches)
  const { data: enrollments } = await admin
    .from('lesson_enrollments')
    .select('id, status, enrolled_at, program:lesson_programs(id, title, coach:coaches(name))')
    .eq('user_id', id)
    .order('enrolled_at', { ascending: false })

  // 레슨 예약 현황 (lesson_bookings → club_members로 연결)
  // member_id를 통해 조회해야 하므로 먼저 club_members id 수집
  const memberIds = (clubMemberships ?? []).map((cm) => cm.id)
  let bookings: Array<{
    id: string
    booking_type: string
    status: string
    fee_amount: number | null
    created_at: string
    confirmed_at: string | null
    cancelled_at: string | null
  }> = []

  if (memberIds.length > 0) {
    const { data: bookingData } = await admin
      .from('lesson_bookings')
      .select('id, booking_type, status, fee_amount, created_at, confirmed_at, cancelled_at')
      .in('member_id', memberIds)
      .order('created_at', { ascending: false })

    bookings = bookingData ?? []
  }

  // 대회 참가 현황
  const { data: tournamentEntries } = await admin
    .from('tournament_entries')
    .select('id, status, payment_status, player_name, created_at, division:division_id(name, tournament:tournament_id(id, title, start_date, location))')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            {profile.name}
          </h1>
          <p className="text-(--text-secondary) mt-1">
            {profile.email}
          </p>
        </div>
      </div>

      <UserDetailView
        profile={profile}
        clubMemberships={(clubMemberships ?? []) as unknown as ClubMembership[]}
        enrollments={(enrollments ?? []) as unknown as Enrollment[]}
        bookings={bookings}
        tournamentEntries={(tournamentEntries ?? []) as unknown as TournamentEntry[]}
      />
    </div>
  )
}
