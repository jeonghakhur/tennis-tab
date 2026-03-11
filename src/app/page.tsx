import { createClient } from '@/lib/supabase/server'
import { HomeFeed } from '@/components/home/HomeFeed'
import { FloatingChat } from '@/components/chat/FloatingChat'
import { GuideOnboardingModal } from '@/components/guide/GuideOnboardingModal'

export default async function Home() {
  const supabase = await createClient()
  const fallback = { data: { user: null } } as const
  const { data: { user } } = await Promise.race([
    supabase.auth.getUser().catch(() => fallback),
    new Promise<typeof fallback>((resolve) => setTimeout(() => resolve(fallback), 3000)),
  ])

  return (
    <>
      <HomeFeed userId={user?.id ?? null} isLoggedIn={!!user} />
      <FloatingChat isLoggedIn={!!user} />
      <GuideOnboardingModal />
    </>
  )
}
