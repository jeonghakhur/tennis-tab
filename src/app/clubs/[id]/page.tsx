'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { getClub, getClubPublicMembers, getClubMemberCount, joinClubAsRegistered, leaveClub } from '@/lib/clubs/actions'
import type { Club, ClubJoinType, ClubMemberRole } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { Modal } from '@/components/common/Modal'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { MapPin, Users, Building2, Phone, Mail, ChevronLeft, User } from 'lucide-react'

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

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, profile } = useAuth()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<PublicMember[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [myMembership, setMyMembership] = useState<PublicMember | null>(null)

  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [introduction, setIntroduction] = useState('')

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (!id) return
    loadClubData()
  }, [id])

  // 사용자 멤버십 확인
  useEffect(() => {
    if (user && members.length > 0) {
      const myMember = members.find(() => false) // 공개 멤버 목록에는 user_id 없음
      // 대신 서버에서 직접 확인 필요 — members에서 이름+역할로는 판단 불가
    }
  }, [user, members])

  const loadClubData = async () => {
    setLoading(true)
    const [clubResult, membersResult, count] = await Promise.all([
      getClub(id),
      getClubPublicMembers(id),
      getClubMemberCount(id),
    ])

    if (clubResult.data) setClub(clubResult.data)
    if (!membersResult.error) setMembers(membersResult.data)
    setMemberCount(count)
    setLoading(false)
  }

  // 멤버십 확인 (로그인한 경우)
  useEffect(() => {
    if (!user || !id) return
    checkMembership()
  }, [user, id])

  const checkMembership = async () => {
    const { getMyClubMembership } = await import('@/lib/clubs/actions')
    const result = await getMyClubMembership()
    if (result.data && result.data.club.id === id) {
      setIsMember(true)
      setMyMembership({
        id: result.data.membership.id,
        name: result.data.membership.name,
        role: result.data.membership.role,
        is_registered: result.data.membership.is_registered,
      })
    }
  }

  const handleJoin = () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // APPROVAL 클럽: 자기소개 모달 열기 / OPEN 클럽: 즉시 가입
    if (club?.join_type === 'APPROVAL') {
      setJoinModalOpen(true)
    } else {
      submitJoin()
    }
  }

  const submitJoin = async (intro?: string) => {
    setJoinModalOpen(false)
    setActionLoading(true)
    const result = await joinClubAsRegistered(id, intro || undefined)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    const message = club?.join_type === 'OPEN'
      ? '클럽에 가입되었습니다!'
      : '가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
    setToast({ isOpen: true, message, type: 'success' })
    setIntroduction('')
    loadClubData()
    checkMembership()
  }

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
    loadClubData()
  }

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!club) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen pt-20 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
        </main>
      </>
    )
  }

  return (
    <>
      <Navigation />
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <main className="min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* 뒤로가기 */}
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            클럽 목록
          </Link>

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

              {/* 가입/탈퇴 버튼 */}
              <div className="shrink-0">
                {isMember ? (
                  <div className="text-center">
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
                ) : club.join_type !== 'INVITE_ONLY' ? (
                  <button
                    onClick={handleJoin}
                    className="btn-primary btn-sm"
                  >
                    {club.join_type === 'OPEN' ? '가입하기' : '가입 신청'}
                  </button>
                ) : (
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
                  >
                    초대 전용
                  </span>
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

          {/* 회원 목록 */}
          <div className="glass-card rounded-xl p-6">
            <h2
              className="font-display text-lg mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              회원 목록 ({memberCount}명)
            </h2>

            {members.length === 0 ? (
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
                      {/* 아바타 */}
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
        </div>
      </main>

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

      {/* 가입 신청 모달 (APPROVAL 클럽) */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="클럽 가입 신청"
        description={`${club.name}에 가입 신청합니다.`}
        size="md"
      >
        <Modal.Body>
          <div>
            <label
              htmlFor="join-introduction"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              자기소개 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
            </label>
            <textarea
              id="join-introduction"
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
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
            <p
              className="text-xs mt-1 text-right"
              style={{ color: 'var(--text-muted)' }}
              aria-live="polite"
            >
              {introduction.length} / 500
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setJoinModalOpen(false)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            onClick={() => submitJoin(introduction)}
            className="flex-1 btn-primary btn-sm"
          >
            가입 신청
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
