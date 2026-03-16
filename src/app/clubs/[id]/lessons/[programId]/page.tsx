'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getMyMembershipInClub } from '@/lib/clubs/actions'
import { LessonProgramDetail } from '@/components/clubs/lessons/LessonProgramDetail'

export default function LessonProgramPage() {
  const { id: clubId, programId } = useParams<{ id: string; programId: string }>()
  const { user, loading: authLoading } = useAuth()
  const [myMemberId, setMyMemberId] = useState<string | undefined>(undefined)
  const [memberChecked, setMemberChecked] = useState(false)

  useEffect(() => {
    if (authLoading || !user?.id) {
      setMemberChecked(true)
      return
    }

    getMyMembershipInClub(clubId).then(({ data }) => {
      setMyMemberId(data?.id || undefined)
      setMemberChecked(true)
    })
  }, [authLoading, user?.id, clubId])

  if (!memberChecked) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            <div className="h-8 w-64 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            <div className="h-48 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <LessonProgramDetail
      programId={programId}
      clubId={clubId}
      myMemberId={myMemberId}
      isLoggedIn={!!user}
    />
  )
}
