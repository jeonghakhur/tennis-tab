import { redirect } from 'next/navigation'

// 레슨은 클럽과 독립 운영 → /lessons/[programId]로 리다이렉트
export default function LegacyLessonPage({
  params,
}: {
  params: { programId: string }
}) {
  redirect(`/lessons/${params.programId}`)
}
