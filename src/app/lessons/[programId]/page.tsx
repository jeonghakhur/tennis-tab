'use client'

import { useParams } from 'next/navigation'
import { LessonProgramDetail } from '@/components/clubs/lessons/LessonProgramDetail'

export default function LessonProgramPage() {
  const { programId } = useParams<{ programId: string }>()

  return <LessonProgramDetail programId={programId} />
}
