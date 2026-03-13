import { createClient, getUserWithTimeout } from '@/lib/supabase/server'
import { HomeFeed } from '@/components/home/HomeFeed'
import { FloatingChat } from '@/components/chat/FloatingChat'
import { GuideOnboardingModal } from '@/components/guide/GuideOnboardingModal'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await getUserWithTimeout(supabase, 3000)

  return (
    <>
      <HomeFeed userId={user?.id ?? null} isLoggedIn={!!user} />
      <FloatingChat isLoggedIn={!!user} />
      <GuideOnboardingModal />
    </>
  )
}
