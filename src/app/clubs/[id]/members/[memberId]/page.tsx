import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberGameResults } from '@/lib/clubs/session-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import MemberResultsClient from './MemberResultsClient'

interface Props {
  params: Promise<{ id: string; memberId: string }>
}

export default async function MemberResultsPage({ params }: Props) {
  const { id: clubId, memberId } = await params
  const admin = createAdminClient()

  // 멤버 정보 조회
  const { data: member } = await admin
    .from('club_members')
    .select('id, name, gender, rating, role, status')
    .eq('id', memberId)
    .eq('club_id', clubId)
    .single()

  if (!member) notFound()

  // 초기 데이터 로드 (전체 기간)
  const { results, stats } = await getMemberGameResults(clubId, memberId, 'all')

  return (
    <div className="min-h-screen bg-(--bg-primary)">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/clubs/${clubId}`}
            className="text-sm text-(--text-muted) hover:text-(--text-primary) transition-colors"
          >
            ← 클럽
          </Link>
          <span className="text-(--text-muted)">/</span>
          <span className="text-sm text-(--text-primary) font-semibold">{member.name}</span>
        </div>

        {/* 멤버 프로필 */}
        <div className="glass-card rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white
              ${member.gender === 'MALE' ? 'bg-blue-500' : member.gender === 'FEMALE' ? 'bg-rose-500' : 'bg-(--accent-color)/60'}`}
              aria-label={member.gender === 'MALE' ? '남성' : member.gender === 'FEMALE' ? '여성' : '성별 미지정'}
            >
              {member.name.slice(0, 1)}
            </div>
            <div>
              <h1 className="text-lg font-bold text-(--text-primary)">{member.name}</h1>
              <div className="flex gap-2 mt-1 flex-wrap">
                {member.rating && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-(--bg-secondary) text-(--text-secondary)">
                    레이팅 {member.rating}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-(--bg-secondary) text-(--text-secondary)">
                  {member.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        <MemberResultsClient
          clubId={clubId}
          memberId={memberId}
          initialResults={results}
          initialStats={stats}
        />
      </div>
    </div>
  )
}
