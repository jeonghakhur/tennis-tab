'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Navigation } from '@/components/Navigation'

interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  phone: string | null
  skill_level: string | null
  dominant_hand: string | null
  club: string | null
  role: string | null
}

interface UserStats {
  tournaments: number
  totalMatches: number
  wins: number
  losses: number
  winRate: number
}

interface Match {
  id: string
  score: string
  completed_at: string
  tournament: {
    title: string
    location: string
  }
  player1: {
    id: string
    name: string
    avatar_url: string | null
  }
  player2: {
    id: string
    name: string
    avatar_url: string | null
  }
  winner: {
    id: string
    name: string
  } | null
}

export default function UserProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    const { getUserProfile } = await import('@/lib/data/user')
    const result = await getUserProfile(userId)
    
    if (!result.error) {
      setProfile(result.profile!)
      setStats(result.stats!)
    }

    // 경기 목록 로드
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    
    const { data: matchesData } = await supabase
      .from('matches')
      .select(`
        *,
        tournament:tournaments(title, location),
        player1:profiles!matches_player1_id_fkey(id, name, avatar_url),
        player2:profiles!matches_player2_id_fkey(id, name, avatar_url),
        winner:profiles!matches_winner_id_fkey(id, name)
      `)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20)

    if (matchesData) {
      setMatches(matchesData as any)
    }

    setLoading(false)
  }

  const skillLevelLabels: Record<string, string> = {
    BEGINNER: '입문',
    INTERMEDIATE: '중급',
    ADVANCED: '고급',
    PROFESSIONAL: '선수급',
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <div className="animate-pulse">
            <div className="w-24 h-24 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--bg-card)' }} />
            <div className="h-8 w-48 mx-auto mb-2" style={{ backgroundColor: 'var(--bg-card)' }} />
          </div>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen pt-20 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <h1 className="text-3xl font-display mb-4" style={{ color: 'var(--text-primary)' }}>
            사용자를 찾을 수 없습니다
          </h1>
          <Link
            href="/"
            className="inline-block px-8 py-3 font-display tracking-wider rounded-xl transition-all duration-300 hover:scale-105"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
          >
            홈으로
          </Link>
        </div>
      </main>
    )
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
        {/* 뒤로 가기 */}
        <Link
          href="/my/profile"
          className="inline-flex items-center gap-2 mb-6 text-sm hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          ← 뒤로 가기
        </Link>

        {/* 프로필 헤더 */}
        <div className="glass-card p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="shrink-0">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center font-display text-3xl font-bold"
                style={{
                  backgroundColor: profile.avatar_url ? 'transparent' : 'var(--accent-color)',
                  color: profile.avatar_url ? 'var(--text-primary)' : 'var(--bg-primary)',
                  border: '3px solid var(--border-accent)',
                }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{profile.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-display mb-2" style={{ color: 'var(--text-primary)' }}>
                {profile.name}
              </h1>

              <div className="flex flex-wrap gap-2 mb-4">
                {profile.skill_level && (
                  <span
                    className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                  >
                    {skillLevelLabels[profile.skill_level]}
                  </span>
                )}
                {profile.club && (
                  <span
                    className="px-3 py-1 text-xs rounded-full font-display tracking-wider"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                  >
                    🏢 {profile.club}
                  </span>
                )}
              </div>

              {/* 팔로우 버튼 (추후 구현) */}
              <button
                disabled
                className="px-6 py-2 text-sm rounded-lg font-display tracking-wider transition-all duration-300 opacity-50 cursor-not-allowed"
                style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
              >
                팔로우 (준비 중)
              </button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-display mb-2" style={{ color: 'var(--accent-color)' }}>
                {stats.tournaments}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                참가 대회
              </div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-display mb-2" style={{ color: 'var(--accent-color)' }}>
                {stats.totalMatches}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                총 경기
              </div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-display mb-2" style={{ color: 'var(--accent-color)' }}>
                {stats.wins}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                승리
              </div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-display mb-2" style={{ color: 'var(--text-muted)' }}>
                {stats.losses}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                패배
              </div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-display mb-2" style={{ color: 'var(--accent-color)' }}>
                {stats.winRate}%
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                승률
              </div>
            </div>
          </div>
        )}

        {/* 경기 결과 */}
        <div>
          <h2 className="text-2xl font-display mb-6" style={{ color: 'var(--text-primary)' }}>
            최근 경기 결과
          </h2>
          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
                  아직 완료된 경기가 없습니다
                </p>
              </div>
            ) : (
              matches.map((match) => {
                const isWinner = match.winner?.id === userId
                const opponent = match.player1.id === userId ? match.player2 : match.player1

                return (
                  <div key={match.id} className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-display mb-1" style={{ color: 'var(--text-primary)' }}>
                          {match.tournament.title}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {new Date(match.completed_at).toLocaleDateString('ko-KR')} · {match.tournament.location}
                        </p>
                      </div>
                      <span
                        className={`px-4 py-2 rounded-full font-display tracking-wider text-sm ${
                          isWinner ? 'badge-open' : 'badge-closed'
                        }`}
                      >
                        {isWinner ? '승리' : '패배'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-4 px-6 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold"
                          style={{
                            backgroundColor: profile.avatar_url ? 'transparent' : 'var(--accent-color)',
                            color: profile.avatar_url ? 'var(--text-primary)' : 'var(--bg-primary)',
                            border: '2px solid var(--border-accent)',
                          }}
                        >
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span>{profile.name.charAt(0)}</span>
                          )}
                        </div>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {profile.name}
                        </span>
                      </div>

                      <div className="text-center px-6">
                        <div className="text-2xl font-display" style={{ color: 'var(--accent-color)' }}>
                          {match.score || 'vs'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                          {opponent.name}
                        </span>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold"
                          style={{
                            backgroundColor: opponent.avatar_url ? 'transparent' : 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            border: '2px solid var(--border-color)',
                          }}
                        >
                          {opponent.avatar_url ? (
                            <img
                              src={opponent.avatar_url}
                              alt={opponent.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span>{opponent.name.charAt(0)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          </div>
        </div>
      </main>
    </>
  )
}
