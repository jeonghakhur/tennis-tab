'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { joinClubAsRegistered, joinClubAsGuest } from '@/lib/clubs/actions'
import type { Club, ClubMemberRole } from '@/lib/clubs/types'
import { Search, MapPin, Users, Check, MessageCircle } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'

// 모듈 레벨 캐시: 뒤로가기 시 재조회 없이 즉시 렌더링
type ClubsListCache = { clubs: Club[]; myClubRoles: Map<string, ClubMemberRole>; search: string }
let clubsListCache: ClubsListCache | null = null

const ROLE_LABEL: Record<string, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  MATCH_DIRECTOR: '경기이사',
  VICE_PRESIDENT: '부회장',
  ADVISOR: '고문',
  MEMBER: '회원',
}

export default function ClubsPage() {
  const { user } = useAuth()

  // 캐시에서 초기값 읽기
  const isCacheValid = clubsListCache && clubsListCache.search === ''
  const [clubs, setClubs] = useState<Club[]>(isCacheValid ? clubsListCache!.clubs : [])
  const [loading, setLoading] = useState(!isCacheValid)
  const [search, setSearch] = useState('')
  const [myClubRoles, setMyClubRoles] = useState<Map<string, ClubMemberRole>>(
    isCacheValid ? clubsListCache!.myClubRoles : new Map()
  )

  // 가입 신청 모달 — 로그인 회원용 (APPROVAL: 자기소개만)
  const [memberJoinTarget, setMemberJoinTarget] = useState<Club | null>(null)
  const [memberIntro, setMemberIntro] = useState('')

  // 가입 신청 모달 — 비로그인용 (이름 + 연락처 + 소개)
  const [guestJoinTarget, setGuestJoinTarget] = useState<Club | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestIntro, setGuestIntro] = useState('')

  const [joinLoading, setJoinLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const loadClubs = useCallback(async () => {
    if (clubsListCache && clubsListCache.search === search) return
    setLoading(true)
    const { getClubsWithMyRoles } = await import('@/lib/clubs/actions')
    const { clubs: data, myClubRoles: roles } = await getClubsWithMyRoles({
      search: search || undefined,
    })
    setClubs(data)
    setMyClubRoles(roles)
    setLoading(false)
    if (!search) {
      clubsListCache = { clubs: data, myClubRoles: roles, search: '' }
    }
  }, [search])

  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  // 내 클럽 우선 + 가나다순 정렬
  const sortedClubs = useMemo(() =>
    [...clubs].sort((a, b) => {
      if (myClubRoles.size > 0) {
        const aIsMine = myClubRoles.has(a.id) ? 0 : 1
        const bIsMine = myClubRoles.has(b.id) ? 0 : 1
        if (aIsMine !== bIsMine) return aIsMine - bIsMine
      }
      return a.name.localeCompare(b.name, 'ko')
    }),
    [clubs, myClubRoles]
  )

  // 가입 신청 버튼 클릭
  const handleJoinClick = useCallback((e: React.MouseEvent, club: Club) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      // 비로그인: 이름+연락처+소개 입력 모달
      setGuestJoinTarget(club)
      setGuestName('')
      setGuestPhone('')
      setGuestIntro('')
      return
    }
    if (club.join_type === 'OPEN') {
      // 로그인 + OPEN: 즉시 가입
      submitMemberJoin(club, undefined)
    } else {
      // 로그인 + APPROVAL: 자기소개 모달
      setMemberJoinTarget(club)
      setMemberIntro('')
    }
  }, [user])

  // 로그인 회원 가입 처리
  const submitMemberJoin = async (club: Club, intro: string | undefined) => {
    setMemberJoinTarget(null)
    setJoinLoading(true)
    const result = await joinClubAsRegistered(club.id, intro || undefined)
    setJoinLoading(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    const message = club.join_type === 'OPEN'
      ? `${club.name}에 가입되었습니다!`
      : `${club.name}에 가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.`
    setToast({ isOpen: true, message, type: 'success' })
    clubsListCache = null
    loadClubs()
  }

  // 비로그인 가입 신청 처리
  const submitGuestJoin = async () => {
    if (!guestJoinTarget) return
    setJoinLoading(true)
    const result = await joinClubAsGuest(
      guestJoinTarget.id,
      guestName,
      guestPhone,
      guestIntro || undefined,
    )
    setJoinLoading(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setGuestJoinTarget(null)
    setToast({
      isOpen: true,
      message: `${guestJoinTarget.name}에 가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.`,
      type: 'success',
    })
  }

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <>
      <div style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          {/* 헤더 */}
          <div className="mb-8">
            <h1
              className="text-3xl font-display mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              테니스 클럽 찾기
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              가까운 테니스 클럽을 찾아 가입해보세요.
            </p>
          </div>

          {/* 검색 */}
          <div className="relative mb-8">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="클럽 이름으로 검색..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>

          {/* 클럽 목록 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-32 rounded mb-3" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-4 w-24 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-4 w-20 rounded mb-4" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  <div className="h-8 w-full rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                </div>
              ))}
            </div>
          ) : clubs.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">🎾</div>
              <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                {search ? '검색 결과가 없습니다' : '등록된 클럽이 없습니다'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? '다른 검색어를 시도해보세요.' : '곧 새로운 클럽이 등록될 예정입니다.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedClubs.map((club) => {
                const myRole = myClubRoles.get(club.id)
                const isMine = !!myRole
                const canJoin = club.is_recruiting && !isMine && club.join_type !== 'INVITE_ONLY'

                return (
                  <div
                    key={club.id}
                    className={`glass-card rounded-xl p-5 flex flex-col relative ${
                      isMine ? 'ring-1 ring-(--accent-color)/40' : ''
                    }`}
                  >
                    {/* 가입 표시 */}
                    {isMine && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-(--accent-color) text-(--bg-primary)">
                        <Check className="w-3 h-3" />
                        {ROLE_LABEL[myRole] || '회원'}
                      </div>
                    )}

                    {/* 클릭 영역: 회원이면 상세 페이지로, 비회원이면 클릭 영역만 */}
                    {isMine ? (
                      <Link href={`/clubs/${club.id}`} className="group flex-1 block">
                        <ClubCardContent club={club} />
                      </Link>
                    ) : (
                      <div className="flex-1">
                        <ClubCardContent club={club} />
                      </div>
                    )}

                    {/* 하단: 가입 버튼 */}
                    {(canJoin || (!isMine && club.join_type === 'INVITE_ONLY' && club.is_recruiting)) && (
                      <div className="flex items-center justify-end pt-3 border-t mt-3" style={{ borderColor: 'var(--border-color)' }}>
                        {canJoin ? (
                          <button
                            onClick={(e) => handleJoinClick(e, club)}
                            disabled={joinLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-(--accent-color) text-(--bg-primary) hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            가입 신청
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>초대 전용</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 로그인 회원 가입 신청 모달 (APPROVAL 클럽 — 자기소개만) */}
      <Modal
        isOpen={!!memberJoinTarget}
        onClose={() => setMemberJoinTarget(null)}
        title="가입 신청"
        description={memberJoinTarget ? `${memberJoinTarget.name}에 가입 신청합니다.` : ''}
        size="md"
      >
        <Modal.Body>
          <div>
            <label
              htmlFor="member-intro"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              자기소개 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
            </label>
            <textarea
              id="member-intro"
              value={memberIntro}
              onChange={(e) => setMemberIntro(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="테니스 경력, 활동 가능 시간 등을 간단히 소개해주세요."
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }} aria-live="polite">
              {memberIntro.length} / 500
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setMemberJoinTarget(null)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            onClick={() => memberJoinTarget && submitMemberJoin(memberJoinTarget, memberIntro)}
            className="flex-1 btn-primary btn-sm"
          >
            가입 신청
          </button>
        </Modal.Footer>
      </Modal>

      {/* 비로그인 가입 신청 모달 (이름 + 연락처 + 소개) */}
      <Modal
        isOpen={!!guestJoinTarget}
        onClose={() => setGuestJoinTarget(null)}
        title="가입 신청"
        description={guestJoinTarget ? `${guestJoinTarget.name}에 가입 신청합니다.` : ''}
        size="md"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="guest-name"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={50}
                placeholder="홍길동"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="guest-phone"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                연락처 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="guest-phone"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                maxLength={20}
                placeholder="010-0000-0000"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="guest-intro"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                본인 소개 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
              </label>
              <textarea
                id="guest-intro"
                value={guestIntro}
                onChange={(e) => setGuestIntro(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="테니스 경력, 활동 가능 시간 등을 간단히 소개해주세요."
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }} aria-live="polite">
                {guestIntro.length} / 500
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setGuestJoinTarget(null)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            onClick={submitGuestJoin}
            disabled={joinLoading || !guestName.trim() || !guestPhone.trim()}
            className="flex-1 btn-primary btn-sm disabled:opacity-50"
          >
            가입 신청
          </button>
        </Modal.Footer>
      </Modal>

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
    </>
  )
}

// 카드 내용 공통 컴포넌트 (hover 클래스는 부모 Link 그룹에 위임)
function ClubCardContent({ club }: { club: Club }) {
  return (
    <>
      <h3
        className="font-display text-lg mb-2 group-hover:text-(--accent-color) transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        {club.name}
      </h3>

      {(club.address || club.city || club.district) && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
            {club.address || [club.city, club.district].filter(Boolean).join(' ')}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-2">
        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          회원 {club._member_count ?? 0}명
        </span>
      </div>

      {club.description && (
        <p
          className="text-sm mb-2 line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {club.description}
        </p>
      )}
    </>
  )
}
