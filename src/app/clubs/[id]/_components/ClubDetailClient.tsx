'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getClub, getClubPublicMembers, getClubMemberCount, getClubMembers, leaveClub, getMyMembershipInClub } from '@/lib/clubs/actions'
import type { Club, ClubJoinType, ClubMemberRole, ClubMember } from '@/lib/clubs/types'
import { ClubMemberList } from '@/components/clubs/ClubMemberList'
import { ClubAwards } from '@/components/awards/ClubAwards'
import SessionList from '@/components/clubs/sessions/SessionList'
import SessionForm from '@/components/clubs/sessions/SessionForm'
import RankingsTab from '@/components/clubs/sessions/RankingsTab'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { MapPin, Users, Building2, Phone, Mail, ChevronLeft, User, Settings, Trophy, Calendar, BarChart3 } from 'lucide-react'
import { KakaoShareButton } from '@/components/common/KakaoShareButton'

// ──────────────────────────────────────────────────────────────────────────────
// 모듈 레벨 캐시: 뒤로가기 시 컴포넌트 remount 후에도 스켈레톤 없이 즉시 렌더링
// ──────────────────────────────────────────────────────────────────────────────
type ClubCacheEntry = { club: Club; memberCount: number }
type MembershipCacheEntry = { isMember: boolean; membership: PublicMember | null }
const clubCache = new Map<string, ClubCacheEntry>()
const membershipCache = new Map<string, MembershipCacheEntry>()

const JOIN_TYPE_LABEL: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

const ROLE_LABEL: Record<ClubMemberRole, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  VICE_PRESIDENT: '부회장',
  ADVISOR: '고문',
  MATCH_DIRECTOR: '경기이사',
  MEMBER: '회원',
}

const ROLE_COLOR: Record<ClubMemberRole, string> = {
  OWNER: 'var(--accent-color)',
  ADMIN: 'var(--court-info)',
  VICE_PRESIDENT: 'var(--color-purple)',
  ADVISOR: 'var(--color-orange)',
  MATCH_DIRECTOR: 'var(--color-success)',
  MEMBER: 'var(--text-muted)',
}

type PublicMember = {
  id: string
  name: string
  role: ClubMemberRole
  is_registered: boolean
}

interface Props {
  clubId: string
}

export default function ClubDetailClient({ clubId: id }: Props) {
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()

  // 캐시에서 초기값 읽기 → 뒤로가기 시 스켈레톤 없이 즉시 렌더링
  const cachedClub = clubCache.get(id)
  const cachedMembership = !authLoading ? membershipCache.get(`${id}:${user?.id ?? 'guest'}`) : undefined

  const [club, setClub] = useState<Club | null>(cachedClub?.club ?? null)
  const [members, setMembers] = useState<PublicMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [awardsLoading, setAwardsLoading] = useState(false)
  const [fullMembersLoading, setFullMembersLoading] = useState(false)
  const [fullMembersLoaded, setFullMembersLoaded] = useState(false)
  const [memberCount, setMemberCount] = useState(cachedClub?.memberCount ?? 0)
  const [loading, setLoading] = useState(!cachedClub)  // 캐시 있으면 스켈레톤 스킵
  const [actionLoading, setActionLoading] = useState(false)
  const [isMember, setIsMember] = useState(cachedMembership?.isMember ?? false)
  const [membershipChecked, setMembershipChecked] = useState(!!cachedMembership)
  const [myMembership, setMyMembership] = useState<PublicMember | null>(cachedMembership?.membership ?? null)

  // 임원(OWNER/ADMIN/MATCH_DIRECTOR) 여부 + 회원 관리용 전체 멤버 데이터
  const isOfficer = myMembership && ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'].includes(myMembership.role)
  const [fullMembers, setFullMembers] = useState<ClubMember[]>([])
  const validTabs = ['sessions', 'rankings', 'info', 'awards', 'manage'] as const
  type ActiveTab = typeof validTabs[number]
  const initialTab = (validTabs.includes(searchParams.get('tab') as ActiveTab)
    ? searchParams.get('tab')
    : 'sessions') as ActiveTab
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [sessionFormOpen, setSessionFormOpen] = useState(false)
  const [clubAwards, setClubAwards] = useState<import('@/lib/supabase/types').Database['public']['Tables']['tournament_awards']['Row'][]>([])

  // 탭 lazy mount: 최초 방문한 탭만 DOM에 마운트 (이후 hidden으로 유지 → 재조회 없음)
  const [mountedTabs, setMountedTabs] = useState<Set<ActiveTab>>(new Set([initialTab]))
  // sessions만 targeted refresh (loadClubData 전체 재조회 없이)
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0)

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab)
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev
      return new Set([...prev, tab])
    })
  }

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmLeave, setConfirmLeave] = useState(false)

  // 클럽 기본 데이터 + 멤버십 병렬 로드
  // 캐시가 있으면 silent(백그라운드 갱신), 없으면 스켈레톤 표시
  useEffect(() => {
    if (!id) return
    loadClubData(!!clubCache.get(id))
  }, [id])

  useEffect(() => {
    if (authLoading || !id) return
    if (!user?.id) {
      setIsMember(false)
      setMembershipChecked(true)
      return
    }
    // 캐시 없으면 스켈레톤, 있으면 silent 갱신 (race condition 방지용 리셋은 캐시 없을 때만)
    if (!membershipCache.get(`${id}:${user?.id}`)) setMembershipChecked(false)
    checkMembership()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, id])

  const loadClubData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [clubResult, count] = await Promise.all([
        getClub(id),
        getClubMemberCount(id),
      ])
      // 실패해도 기존 club 데이터 유지 (null로 덮어쓰지 않음)
      if (clubResult.data) {
        setClub(clubResult.data)
        clubCache.set(id, { club: clubResult.data, memberCount: count })
      }
      setMemberCount(count)
    } finally {
      setLoading(false)
    }
  }

  // 회원 목록: 해당 탭 클릭 시 지연 로드
  useEffect(() => {
    if (activeTab !== 'info' || !id || members.length > 0) return
    setMembersLoading(true)
    Promise.all([getClubPublicMembers(id), getClubMemberCount(id)]).then(([membersResult, count]) => {
      if (!membersResult.error) setMembers(membersResult.data)
      setMemberCount(count)
      setMembersLoading(false)
    })
  }, [activeTab, id])

  const checkMembership = async () => {
    if (!id) return
    try {
      // admin 클라이언트 기반 서버 액션 사용 → 브라우저 Supabase 세션과 무관하게 안정적
      const { data } = await getMyMembershipInClub(id)
      const cacheKey = `${id}:${user?.id ?? 'guest'}`
      if (data) {
        setIsMember(true)
        setMyMembership(data)
        membershipCache.set(cacheKey, { isMember: true, membership: data })
      } else {
        setIsMember(false)
        setMyMembership(null)
        membershipCache.set(cacheKey, { isMember: false, membership: null })
      }
    } catch {
      setIsMember(false)
      setMyMembership(null)
    } finally {
      setMembershipChecked(true)
    }
  }

  // 임원 전체 회원 데이터: 관리 탭 클릭 시 지연 로드
  useEffect(() => {
    if (!isOfficer || !id || fullMembersLoaded) return
    setFullMembersLoading(true)
    getClubMembers(id).then(r => {
      if (!r.error) setFullMembers(r.data)
      setFullMembersLoaded(true)
      setFullMembersLoading(false)
    })
  }, [isOfficer, activeTab, id])

  // 입상 기록: 탭 클릭 시 지연 로드
  useEffect(() => {
    if (activeTab !== 'awards' || !id || !club || clubAwards.length > 0) return
    setAwardsLoading(true)
    import('@/lib/awards/actions').then(({ getClubAwards }) =>
      getClubAwards(id, club.name)
        .then(data => { setClubAwards(data); setAwardsLoading(false) })
        .catch(() => setAwardsLoading(false))
    )
  }, [activeTab, id, club])

  const handleLeave = async () => {
    setConfirmLeave(false)
    setActionLoading(true)
    const result = await leaveClub(id)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '클럽에서 탈퇴했습니다.', type: 'success' })
    setIsMember(false)
    setMyMembership(null)
    membershipCache.delete(`${id}:${user?.id ?? 'guest'}`)
    loadClubData(true)   // silent: 스켈레톤 플래시 방지
  }

  if (loading || !membershipChecked) {
    return (
      <>
        <div className="" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-content mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!club) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="text-center">
            <h1 className="text-2xl font-display mb-4" style={{ color: 'var(--text-primary)' }}>
              클럽을 찾을 수 없습니다
            </h1>
            <Link
              href="/clubs"
              className="text-sm hover:underline"
              style={{ color: 'var(--accent-color)' }}
            >
              클럽 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <div className="" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            클럽 목록
          </Link>

          {/* 비회원: 기본 정보 + 가입 안내만 표시 */}
          {!isMember ? (
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start justify-between mb-3">
                <h1
                  className="text-2xl font-display"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {club.name}
                </h1>
                <KakaoShareButton
                  title={club.name}
                  description={club.description?.slice(0, 100) ?? `${club.name} — 마포구테니스협회 클럽`}
                  pageUrl={`/clubs/${id}`}
                  compact
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-3">
                {(club.city || club.district) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {[club.city, club.district].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {club.associations?.name || '독립 클럽'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    회원 {memberCount}명
                  </span>
                </div>
              </div>

              {/* 클럽 소개 */}
              {club.description && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {club.description}
                  </p>
                </div>
              )}

              {/* 가입 안내 */}
              <div className="mt-6 pt-4 border-t text-center space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  클럽 상세 정보는 가입 후 이용할 수 있습니다.
                </p>
                <Link
                  href="/clubs"
                  className="inline-block btn-primary btn-sm"
                >
                  클럽 목록에서 가입 신청하기
                </Link>
              </div>
            </div>
          ) : (
            /* 회원: 전체 상세 페이지 */
            <>
              {/* 클럽 헤더 */}
              <div className="glass-card rounded-xl p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h1
                      className="text-2xl font-display mb-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {club.name}
                    </h1>

                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      {(club.city || club.district) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {[club.city, club.district].filter(Boolean).join(' ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {club.associations?.name || '독립 클럽'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          회원 {memberCount}명
                        </span>
                      </div>
                    </div>

                    {/* 대표자 & 연락처 */}
                    <div className="flex flex-wrap gap-4">
                      {club.representative_name && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {club.representative_name}
                          </span>
                        </div>
                      )}
                      {club.contact_phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {club.contact_phone}
                          </span>
                        </div>
                      )}
                      {club.contact_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {club.contact_email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 역할 + 탈퇴 */}
                  <div className="shrink-0 text-center">
                    <span
                      className="block text-xs mb-2 px-3 py-1 rounded-full font-medium"
                      style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                    >
                      {ROLE_LABEL[myMembership?.role || 'MEMBER']}
                    </span>
                    {myMembership?.role !== 'OWNER' && (
                      <button
                        onClick={() => setConfirmLeave(true)}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        탈퇴하기
                      </button>
                    )}
                  </div>
                </div>

                {/* 클럽 소개 */}
                {club.description && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {club.description}
                    </p>
                  </div>
                )}

                {/* 주소 */}
                {club.address && (
                  <div className="mt-3">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      📍 {club.address}
                    </p>
                  </div>
                )}
              </div>

              {/* 탭 헤더 — 회원은 회원목록+입상기록, 임원은 회원관리 추가 */}
              {/* 탭 - 아이콘+텍스트, 균등 분할 */}
              {(() => {
                const tabs = [
                  { key: 'sessions', icon: <Calendar className="w-4 h-4" />, label: '모임' },
                  { key: 'rankings', icon: <BarChart3 className="w-4 h-4" />, label: '순위' },
                  { key: 'info', icon: <Users className="w-4 h-4" />, label: '회원' },
                  { key: 'awards', icon: <Trophy className="w-4 h-4" />, label: '입상' },
                  ...(isOfficer ? [{ key: 'manage', icon: <Settings className="w-4 h-4" />, label: '관리' }] : []),
                ] as const
                return (
                  <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key as ActiveTab)}
                        className={`flex-1 flex flex-row items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors relative ${
                          activeTab === tab.key
                            ? 'text-(--accent-color)'
                            : 'text-(--text-secondary) hover:text-(--text-primary)'
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.key && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color)" />
                        )}
                      </button>
                    ))}
                  </div>
                )
              })()}

              {/* 탭 콘텐츠 — lazy mount + hidden 방식 (unmount 없으므로 탭 전환 시 재조회 없음) */}

              {/* 모임 탭 */}
              <div className={`mt-4${activeTab !== 'sessions' ? ' hidden' : ''}`}>
                {mountedTabs.has('sessions') && (
                  <>
                    <SessionList
                      clubId={id}
                      isOfficer={!!isOfficer}
                      onCreateSession={() => setSessionFormOpen(true)}
                      refreshKey={sessionRefreshKey}
                    />
                    <SessionForm
                      clubId={id}
                      isOpen={sessionFormOpen}
                      onClose={() => setSessionFormOpen(false)}
                      onCreated={() => setSessionRefreshKey((k) => k + 1)}
                    />
                  </>
                )}
              </div>

              {/* 순위 탭 */}
              <div className={`mt-4${activeTab !== 'rankings' ? ' hidden' : ''}`}>
                {mountedTabs.has('rankings') && (
                  <RankingsTab
                    clubId={id}
                    myMemberId={myMembership?.id}
                    isOfficer={!!isOfficer}
                  />
                )}
              </div>

              {/* 회원 탭 */}
              <div className={`${activeTab !== 'info' ? 'hidden' : ''}`}>
                {mountedTabs.has('info') && (
                  <div className="glass-card rounded-xl p-6">
                    <h2
                      className="font-display text-lg mb-4"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      회원 목록 ({memberCount}명)
                    </h2>

                    {membersLoading ? (
                      <div className="space-y-2 animate-pulse">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-11 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                        ))}
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                        아직 회원이 없습니다.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                            style={{ backgroundColor: 'var(--bg-card-hover)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{
                                  backgroundColor: ROLE_COLOR[member.role],
                                  color: member.role === 'MEMBER' ? 'var(--text-primary)' : 'var(--bg-primary)',
                                }}
                              >
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {member.name}
                                </span>
                                {!member.is_registered && (
                                  <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    (비가입)
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: member.role === 'OWNER' ? 'var(--accent-color)' : 'transparent',
                                color: member.role === 'OWNER' ? 'var(--bg-primary)' : 'var(--text-muted)',
                                border: member.role !== 'OWNER' ? '1px solid var(--border-color)' : 'none',
                              }}
                            >
                              {ROLE_LABEL[member.role]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 입상 탭 */}
              <div className={`mt-4${activeTab !== 'awards' ? ' hidden' : ''}`}>
                {mountedTabs.has('awards') && (
                  awardsLoading ? (
                    <div className="space-y-3 animate-pulse">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                      ))}
                    </div>
                  ) : (
                    <ClubAwards awards={clubAwards} />
                  )
                )}
              </div>

              {/* 관리 탭 (임원 전용) */}
              {isOfficer && (
                <div className={`mt-4${activeTab !== 'manage' ? ' hidden' : ''}`}>
                  {mountedTabs.has('manage') && (
                    fullMembersLoading ? (
                      <div className="space-y-2 animate-pulse">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="h-11 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                        ))}
                      </div>
                    ) : (
                      // fullMembersLoaded 후 마운트 → useState(initialMembers)가 정확한 데이터로 초기화됨
                      <ClubMemberList
                        key="manage"
                        clubId={id}
                        initialMembers={fullMembers}
                        isSystemAdmin={false}
                      />
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
        title="클럽 탈퇴"
        message={`${club.name}에서 탈퇴하시겠습니까?`}
        type="warning"
      />

    </>
  )
}
