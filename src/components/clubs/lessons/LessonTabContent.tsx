'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getAllLessonPrograms } from '@/lib/lessons/actions'
import { LessonProgramCard } from './LessonProgramCard'
import type { LessonProgram } from '@/lib/lessons/types'

interface LessonTabContentProps {
  clubId: string
  isAdmin: boolean
  onCreateProgram?: () => void
}

export function LessonTabContent({ clubId, isAdmin, onCreateProgram }: LessonTabContentProps) {
  const [programs, setPrograms] = useState<LessonProgram[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPrograms()
  }, [clubId])

  const loadPrograms = async () => {
    const { data } = await getAllLessonPrograms()
    setPrograms(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  // DRAFT 프로그램은 어드민에게만 표시
  const visiblePrograms = isAdmin
    ? programs
    : programs.filter((p) => p.status !== 'DRAFT')

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onCreateProgram}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--bg-primary)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            프로그램 등록
          </button>
        </div>
      )}

      {visiblePrograms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            등록된 레슨 프로그램이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePrograms.map((program) => (
            <LessonProgramCard
              key={program.id}
              program={program}
              clubId={clubId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
