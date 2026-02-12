'use client'

import { useState, useCallback, useRef } from 'react'
import type { ClubMember, ClubMemberRole, UnregisteredMemberInput, GenderType } from '@/lib/clubs/types'
import {
  addUnregisteredMember,
  removeMember,
  updateMemberRole,
  respondJoinRequest,
  searchUsersForInvite,
  inviteMember,
} from '@/lib/clubs/actions'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { UserPlus, UserMinus, Search, Mail } from 'lucide-react'
import {
  sanitizeInput,
  validateMemberInput,
  hasValidationErrors,
  type MemberValidationErrors,
} from '@/lib/utils/validation'
import {
  generateMemberDummy,
  generateMemberInvalidDummy,
} from '@/lib/utils/devDummy'
import { Badge, type BadgeVariant } from '@/components/common/Badge'

const isDev = process.env.NODE_ENV === 'development'

interface ClubMemberListProps {
  clubId: string
  initialMembers: ClubMember[]
}

type MemberFilter = 'all' | 'registered' | 'unregistered'

const ROLE_BADGE: Record<ClubMemberRole, { label: string; variant: BadgeVariant }> = {
  OWNER: { label: 'OWNER', variant: 'warning' },
  ADMIN: { label: 'ADMIN', variant: 'info' },
  MEMBER: { label: 'MEMBER', variant: 'secondary' },
}

const GENDER_LABEL: Record<GenderType, string> = { MALE: '남성', FEMALE: '여성' }

export function ClubMemberList({ clubId, initialMembers }: ClubMemberListProps) {
  const [members, setMembers] = useState(initialMembers)
  const [filter, setFilter] = useState<MemberFilter>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [removeModalOpen, setRemoveModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirm, setConfirm] = useState({ isOpen: false, message: '', onConfirm: () => {} })

  // 가입회원 초대
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteResults, setInviteResults] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 비가입 회원 추가 폼
  const [newMember, setNewMember] = useState<UnregisteredMemberInput>({
    name: '',
    birth_date: '',
    gender: undefined,
    phone: '',
    start_year: '',
    rating: undefined,
  })
  const [memberErrors, setMemberErrors] = useState<MemberValidationErrors>({})
  const errorFieldRef = useRef<keyof MemberValidationErrors | null>(null)
  const memberFieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // 필터된 회원 목록
  const filteredMembers = members.filter((m) => {
    if (filter === 'registered') return m.is_registered
    if (filter === 'unregistered') return !m.is_registered
    return true
  })

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length
  const pendingMembers = members.filter((m) => m.status === 'PENDING')

  // 사용자 검색 (디바운스 300ms)
  const handleInviteSearch = useCallback((value: string) => {
    setInviteQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setInviteResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setInviteLoading(true)
      const result = await searchUsersForInvite(clubId, value)
      if (!result.error) {
        setInviteResults(result.data)
      }
      setInviteLoading(false)
    }, 300)
  }, [clubId])

  // 가입회원 초대
  const handleInvite = async (userId: string, userName: string) => {
    const result = await inviteMember(clubId, userId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: `${userName}님을 초대했습니다.`, type: 'success' })
    // 검색 결과에서 제거
    setInviteResults((prev) => prev.filter((u) => u.id !== userId))
    window.location.reload()
  }

  // 필드 변경 핸들러 (sanitize + 에러 클리어)
  const handleMemberChange = useCallback((field: keyof UnregisteredMemberInput, value: string) => {
    const sanitized = sanitizeInput(value)
    setNewMember((prev) => ({ ...prev, [field]: sanitized }))
    setMemberErrors((prev) => ({ ...prev, [field]: undefined }))
  }, [])

  // 순차 검증 필드 순서
  const MEMBER_FIELD_ORDER: (keyof MemberValidationErrors)[] = [
    'name', 'birth_date', 'phone', 'start_year', 'rating',
  ]

  // 비가입 회원 추가
  const handleAddMember = async () => {
    const errors = validateMemberInput(newMember)
    if (hasValidationErrors(errors)) {
      // 순서대로 첫 번째 에러만 표시
      for (const field of MEMBER_FIELD_ORDER) {
        if (errors[field]) {
          errorFieldRef.current = field
          setMemberErrors({ [field]: errors[field] })
          setAlert({ isOpen: true, message: errors[field]!, type: 'error' })
          return
        }
      }
      return
    }
    setMemberErrors({})

    const result = await addUnregisteredMember(clubId, {
      ...newMember,
      rating: newMember.rating ? Number(newMember.rating) : undefined,
    })

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '회원이 등록되었습니다.', type: 'success' })
    setAddModalOpen(false)
    setNewMember({ name: '', birth_date: '', gender: undefined, phone: '', start_year: '', rating: undefined })
    setMemberErrors({})
    window.location.reload()
  }

  // 모달 초기화
  const resetAddModal = useCallback(() => {
    setAddModalOpen(false)
    setNewMember({ name: '', birth_date: '', gender: undefined, phone: '', start_year: '', rating: undefined })
    setMemberErrors({})
  }, [])

  // 회원 제거
  const handleRemoveMember = async () => {
    if (!selectedMember) return
    if (!removeReason.trim()) {
      setAlert({ isOpen: true, message: '제거 사유를 입력해주세요.', type: 'error' })
      return
    }

    const result = await removeMember(selectedMember.id, removeReason)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id))
    setToast({ isOpen: true, message: '회원이 제거되었습니다.', type: 'success' })
    setRemoveModalOpen(false)
    setSelectedMember(null)
    setRemoveReason('')
  }

  // 역할 변경
  const handleRoleChange = (member: ClubMember, newRole: ClubMemberRole) => {
    setConfirm({
      isOpen: true,
      message: `${member.name}님의 역할을 ${newRole}(으)로 변경하시겠습니까?`,
      onConfirm: async () => {
        const result = await updateMemberRole(member.id, newRole)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
          return
        }
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
        )
        setToast({ isOpen: true, message: '역할이 변경되었습니다.', type: 'success' })
      },
    })
  }

  // 가입 신청 승인/거절
  const handleJoinResponse = async (member: ClubMember, approve: boolean) => {
    const result = await respondJoinRequest(member.id, approve)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    if (approve) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, status: 'ACTIVE' } : m))
      )
      setToast({ isOpen: true, message: `${member.name}님의 가입을 승인했습니다.`, type: 'success' })
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      setToast({ isOpen: true, message: `${member.name}님의 가입을 거절했습니다.`, type: 'success' })
    }
  }

  return (
    <div className="space-y-4">
      {/* 승인 대기 회원 */}
      {pendingMembers.length > 0 && (
        <div className="glass-card rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium text-(--text-primary)">
            가입 승인 대기 ({pendingMembers.length}명)
          </h3>
          {pendingMembers.map((m) => (
            <div key={m.id} className="py-3 border-b border-(--border-color) last:border-0">
              <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-(--text-primary)">{m.name}</p>
                <p className="text-xs text-(--text-muted)">{m.phone}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleJoinResponse(m, true)}
                  className="px-3 py-1 rounded text-xs font-medium bg-(--accent-color) text-(--bg-primary)"
                >
                  승인
                </button>
                <button
                  onClick={() => handleJoinResponse(m, false)}
                  className="px-3 py-1 rounded text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/10"
                >
                  거절
                </button>
              </div>
              </div>
              {/* 자기소개 */}
              {m.introduction && (
                <p
                  className="mt-2 text-xs whitespace-pre-wrap rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                >
                  {m.introduction}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 액션 버튼 + 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="btn-primary btn-sm flex items-center gap-1"
          >
            <Mail className="w-4 h-4" />
            가입회원 초대
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="btn-secondary btn-sm flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            비가입 회원 추가
          </button>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-(--border-color)">
          {(['all', 'registered', 'unregistered'] as MemberFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-(--accent-color) text-(--bg-primary)'
                  : 'text-(--text-muted) hover:text-(--text-primary)'
              }`}
            >
              {f === 'all' ? '전체' : f === 'registered' ? '가입회원' : '비가입회원'}
            </button>
          ))}
        </div>
      </div>

      {/* 회원 목록 */}
      <div className="text-sm text-(--text-muted) mb-1">
        활성 회원 {activeCount}명
      </div>
      {filteredMembers.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-(--text-muted)">회원이 없습니다.</p>
        </div>
      ) : (
        <div className="glass-card rounded-lg divide-y divide-(--border-color)">
          {filteredMembers.map((member) => (
            <div key={member.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-(--text-primary)">{member.name}</span>
                    <Badge variant={ROLE_BADGE[member.role].variant}>
                      {ROLE_BADGE[member.role].label}
                    </Badge>
                    <span className={`text-xs ${member.is_registered ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                      {member.is_registered ? '가입회원' : '비가입회원'}
                    </span>
                    {member.status === 'INVITED' && (
                      <span className="text-xs text-amber-500">초대됨</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-(--text-muted) flex-wrap">
                    {member.phone && <span>{member.phone}</span>}
                    {member.gender && <span>{GENDER_LABEL[member.gender as GenderType]}</span>}
                    {member.birth_date && <span>{member.birth_date}</span>}
                    {member.start_year && <span>{member.start_year}년 입문</span>}
                    {member.rating && <span>레이팅 {member.rating}</span>}
                  </div>
                </div>

                {/* 관리 버튼 (OWNER는 제거/변경 불가) */}
                {member.role !== 'OWNER' && (
                  <div className="flex items-center gap-2">
                    {/* 역할 변경 */}
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as ClubMemberRole)}
                      className="text-xs px-2 py-1 rounded bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                    {/* 제거 */}
                    <button
                      onClick={() => {
                        setSelectedMember(member)
                        setRemoveModalOpen(true)
                      }}
                      className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                      title="제거"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 비가입 회원 추가 모달 */}
      <Modal
        isOpen={addModalOpen}
        onClose={resetAddModal}
        title="비가입 회원 추가"
        size="lg"
      >
        <Modal.Body>
          <div className="space-y-4">
            {/* DEV 전용 더미 데이터 버튼 */}
            {isDev && (
              <div className="flex gap-2 pb-2 border-b border-dashed border-amber-500/30">
                <button
                  type="button"
                  onClick={() => { setNewMember(generateMemberDummy()); setMemberErrors({}) }}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                >
                  DEV: 정상 더미
                </button>
                <button
                  type="button"
                  onClick={() => { setNewMember(generateMemberInvalidDummy()); setMemberErrors({}) }}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  DEV: 잘못된 데이터
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                ref={(el) => { memberFieldRefs.current.name = el }}
                type="text"
                value={newMember.name}
                onChange={(e) => handleMemberChange('name', e.target.value)}
                maxLength={100}
                className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                  memberErrors.name ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                }`}
              />
              {memberErrors.name && <p className="mt-1 text-xs text-red-500">{memberErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">생년월일</label>
                <input
                  ref={(el) => { memberFieldRefs.current.birth_date = el }}
                  type="text"
                  value={newMember.birth_date || ''}
                  onChange={(e) => handleMemberChange('birth_date', e.target.value)}
                  placeholder="YYYY-MM"
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    memberErrors.birth_date ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {memberErrors.birth_date && <p className="mt-1 text-xs text-red-500">{memberErrors.birth_date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">성별</label>
                <div className="flex gap-4 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={newMember.gender === 'MALE'}
                      onChange={() => setNewMember({ ...newMember, gender: 'MALE' })}
                      className="accent-(--accent-color)"
                    />
                    <span className="text-sm text-(--text-primary)">남성</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={newMember.gender === 'FEMALE'}
                      onChange={() => setNewMember({ ...newMember, gender: 'FEMALE' })}
                      className="accent-(--accent-color)"
                    />
                    <span className="text-sm text-(--text-primary)">여성</span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">연락처</label>
              <input
                ref={(el) => { memberFieldRefs.current.phone = el }}
                type="text"
                value={newMember.phone || ''}
                onChange={(e) => handleMemberChange('phone', e.target.value)}
                placeholder="010-1234-5678"
                className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                  memberErrors.phone ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                }`}
              />
              {memberErrors.phone && <p className="mt-1 text-xs text-red-500">{memberErrors.phone}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">테니스 입문년도</label>
                <input
                  ref={(el) => { memberFieldRefs.current.start_year = el }}
                  type="text"
                  value={newMember.start_year || ''}
                  onChange={(e) => handleMemberChange('start_year', e.target.value)}
                  placeholder="2020"
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    memberErrors.start_year ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {memberErrors.start_year && <p className="mt-1 text-xs text-red-500">{memberErrors.start_year}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">레이팅</label>
                <input
                  ref={(el) => { memberFieldRefs.current.rating = el }}
                  type="number"
                  value={newMember.rating || ''}
                  onChange={(e) => {
                    setNewMember({ ...newMember, rating: e.target.value ? Number(e.target.value) : undefined })
                    setMemberErrors((prev) => ({ ...prev, rating: undefined }))
                  }}
                  placeholder="1~9999"
                  min={1}
                  max={9999}
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    memberErrors.rating ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {memberErrors.rating && <p className="mt-1 text-xs text-red-500">{memberErrors.rating}</p>}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={resetAddModal} className="btn-secondary btn-sm flex-1">
            취소
          </button>
          <button onClick={handleAddMember} className="btn-primary btn-sm flex-1">
            <span className="relative z-10">등록</span>
          </button>
        </Modal.Footer>
      </Modal>

      {/* 제거 사유 모달 */}
      <Modal
        isOpen={removeModalOpen}
        onClose={() => { setRemoveModalOpen(false); setSelectedMember(null); setRemoveReason('') }}
        title="회원 제거 사유"
        size="md"
      >
        <Modal.Body>
          <p className="text-sm text-(--text-secondary) mb-3">
            <span className="font-medium text-(--text-primary)">{selectedMember?.name}</span> 회원을 제거합니다.
          </p>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              제거 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="예: 장기 미활동, 본인 요청 등"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none resize-none"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => { setRemoveModalOpen(false); setSelectedMember(null); setRemoveReason('') }}
            className="btn-secondary btn-sm flex-1"
          >
            취소
          </button>
          <button
            onClick={handleRemoveMember}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            제거 확인
          </button>
        </Modal.Footer>
      </Modal>

      {/* 가입회원 초대 모달 */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => { setInviteModalOpen(false); setInviteQuery(''); setInviteResults([]) }}
        title="가입회원 초대"
        size="lg"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
              <input
                type="text"
                value={inviteQuery}
                onChange={(e) => handleInviteSearch(e.target.value)}
                placeholder="이름 또는 이메일로 검색 (2글자 이상)"
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
                autoFocus
              />
            </div>

            {inviteLoading && (
              <p className="text-sm text-(--text-muted) text-center py-2">검색 중...</p>
            )}

            {!inviteLoading && inviteQuery.length >= 2 && inviteResults.length === 0 && (
              <p className="text-sm text-(--text-muted) text-center py-4">검색 결과가 없습니다.</p>
            )}

            {inviteResults.length > 0 && (
              <div className="divide-y divide-(--border-color) rounded-lg border border-(--border-color) max-h-64 overflow-y-auto">
                {inviteResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-(--text-primary)">{user.name}</p>
                      <p className="text-xs text-(--text-muted)">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleInvite(user.id, user.name)}
                      className="btn-primary btn-sm text-xs"
                    >
                      초대
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => { setInviteModalOpen(false); setInviteQuery(''); setInviteResults([]) }}
            className="btn-secondary btn-sm flex-1"
          >
            닫기
          </button>
        </Modal.Footer>
      </Modal>

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => {
        setAlert({ ...alert, isOpen: false })
        const key = errorFieldRef.current
        if (key) {
          memberFieldRefs.current[key]?.focus()
          errorFieldRef.current = null
        }
      }} title="오류" message={alert.message} type={alert.type} />
      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ ...confirm, isOpen: false })} onConfirm={confirm.onConfirm} message={confirm.message} type="warning" />
    </div>
  )
}
