'use client'

import { useParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { LessonProgramDetail } from '@/components/clubs/lessons/LessonProgramDetail'

export default function LessonProgramPage() {
  const { programId } = useParams<{ programId: string }>()
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
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
      myUserId={user?.id}
      isLoggedIn={!!user}
    />
  )
}
