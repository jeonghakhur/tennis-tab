import {
  getActiveTournaments,
  getMyClubUpcomingSessions,
  getPinnedNotices,
} from '@/lib/home/actions'
import { getPostsFeed } from '@/lib/community/actions'
import { NoticeBanner } from './NoticeBanner'
import { ActiveTournamentsSection } from './ActiveTournamentsSection'
import { ClubScheduleSection } from './ClubScheduleSection'
import { RecentPostsSection } from './RecentPostsSection'

interface HomeFeedProps {
  userId: string | null
  isLoggedIn: boolean
}

export async function HomeFeed({ userId, isLoggedIn }: HomeFeedProps) {
  const [notices, activeTournaments, postsResult, clubSessions] = await Promise.all([
    getPinnedNotices(),
    getActiveTournaments(),
    getPostsFeed({ limit: 6 }),
    userId ? getMyClubUpcomingSessions(userId) : Promise.resolve([]),
  ])

  return (
    <main className="max-w-content mx-auto px-4 py-8 space-y-10">
      <NoticeBanner notices={notices} />
      <ActiveTournamentsSection tournaments={activeTournaments} />
      {userId && clubSessions.length > 0 && (
        <ClubScheduleSection sessions={clubSessions} />
      )}
      <RecentPostsSection posts={postsResult.data} isLoggedIn={isLoggedIn} />
    </main>
  )
}
