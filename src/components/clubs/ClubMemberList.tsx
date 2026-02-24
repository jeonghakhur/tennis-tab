'use client'

import { useState, useCallback, useRef } from 'react'
import type { ClubMember, ClubMemberRole, UnregisteredMemberInput, GenderType } from '@/lib/clubs/types'
import {
  addUnregisteredMember,
  removeMember,
  restoreMember,
  updateMemberRole,
  updateMemberInfo,
  respondJoinRequest,
  searchUsersForInvite,
  inviteMember,
} from '@/lib/clubs/actions'
import { useClubMembersRealtime } from '@/lib/realtime/useClubMembersRealtime'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { UserPlus, UserMinus, RotateCcw, Search, Mail } from 'lucide-react'
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
  isSystemAdmin?: boolean
}

type MemberFilter = 'all' | 'registered' | 'unregistered' | 'removed'

const ROLE_BADGE: Record<ClubMemberRole, { label: string; variant: BadgeVariant }> = {
  OWNER: { label: '회장', variant: 'warning' },
  ADMIN: { label: '총무', variant: 'info' },
  VICE_PRESIDENT: { label: '부회장', variant: 'purple' },
  ADVISOR: { label: '고문', variant: 'orange' },
  MATCH_DIRECTOR: { label: '경기이사', variant: 'success' },
  MEMBER: { label: '회원', variant: 'secondary' },
}

const GENDER_LABEL: Record<GenderType, string> = { MALE: '남성', FEMALE: '여성' }

export function ClubMemberList({ clubId, initialMembers, isSystemAdmin = false }: ClubMemberListProps) {
  const [members, setMembers] = useState(initialMembers)
  const [filter, setFilter] = useState<MemberFilter>('all')

  // Realtime 구독 — club_members 변경 시 자동 반영
  useClubMembersRealtime({ clubId, onMembersChange: setMembers })
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

  // 회원 상세/수정 모달
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editMember, setEditMember] = useState<ClubMember | null>(null)
  const [editForm, setEditForm] = useState<UnregisteredMemberInput>({
    name: '', birth_date: '', gender: undefined, phone: '', start_year: '', rating: undefined,
  })
  const [editErrors, setEditErrors] = useState<MemberValidationErrors>({})
  const [editSaving, setEditSaving] = useState(false)
  const editFieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // 필터된 회원 목록 (PENDING은 별도 섹션에 표시하므로 제외)
  const filteredMembers = members.filter((m) => {
    if (m.status === 'PENDING') return false
    if (filter === 'removed') return m.status === 'REMOVED' || m.status === 'LEFT'
    // 제거/탈퇴 필터가 아닌 경우 제거/탈퇴 회원은 숨김
    if (m.status === 'REMOVED' || m.status === 'LEFT') return false
    if (filter === 'registered') return m.is_registered
    if (filter === 'unregistered') return !m.is_registered
    return true
  })

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length
  const removedCount = members.filter((m) => m.status === 'REMOVED' || m.status === 'LEFT').length
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
    // 검색 결과에서 제거 (Realtime이 members 상태를 자동 갱신)
    setInviteResults((prev) => prev.filter((u) => u.id !== userId))
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

    // 즉시 UI 반영 (Realtime도 백업으로 동작)
    setMembers((prev) =>
      prev.map((m) => m.id === selectedMember.id ? { ...m, status: 'REMOVED' as const, status_reason: removeReason } : m)
    )
    setToast({ isOpen: true, message: '회원이 제거되었습니다.', type: 'success' })
    setRemoveModalOpen(false)
    setSelectedMember(null)
    setRemoveReason('')
  }

  // 회원 원복 (REMOVED/LEFT → ACTIVE)
  const handleRestoreMember = (member: ClubMember) => {
    setConfirm({
      isOpen: true,
      message: `${member.name}님을 다시 활성 회원으로 원복하시겠습니까?`,
      onConfirm: async () => {
        setConfirm((prev) => ({ ...prev, isOpen: false }))
        const result = await restoreMember(member.id)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
          return
        }
        setMembers((prev) =>
          prev.map((m) => m.id === member.id ? { ...m, status: 'ACTIVE' as const, status_reason: null } : m)
        )
        setToast({ isOpen: true, message: `${member.name}님이 원복되었습니다.`, type: 'success' })
      },
    })
  }

  // 역할 변경
  const handleRoleChange = (member: ClubMember, newRole: ClubMemberRole) => {
    setConfirm({
      isOpen: true,
      message: `${member.name}님의 역할을 ${newRole}(으)로 변경하시겠습니까?`,
      onConfirm: async () => {
        setConfirm((prev) => ({ ...prev, isOpen: false }))
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

  // 회원 상세 열기
  const openEditModal = (member: ClubMember) => {
    setEditMember(member)
    setEditForm({
      name: member.name,
      birth_date: member.birth_date || '',
      gender: member.gender as GenderType | undefined,
      phone: member.phone || '',
      start_year: member.start_year || '',
      rating: member.rating ?? undefined,
    })
    setEditErrors({})
    setEditModalOpen(true)
  }

  // 회원 정보 저장
  const handleEditSave = async () => {
    if (!editMember || editSaving) return

    // 검증
    const errors = validateMemberInput(editForm)
    if (hasValidationErrors(errors)) {
      const FIELD_ORDER: (keyof MemberValidationErrors)[] = ['name', 'phone', 'birth_date', 'start_year', 'rating']
      for (const field of FIELD_ORDER) {
        if (errors[field]) {
          setEditErrors({ [field]: errors[field] })
          setAlert({ isOpen: true, message: errors[field]!, type: 'error' })
          return
        }
      }
      return
    }

    setEditSaving(true)
    try {
      const result = await updateMemberInfo(editMember.id, editForm)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      // 로컬 상태 즉시 반영
      setMembers((prev) =>
        prev.map((m) => m.id === editMember.id ? {
          ...m,
          name: editForm.name,
          birth_date: editForm.birth_date || null,
          gender: editForm.gender || null,
          phone: editForm.phone || null,
          start_year: editForm.start_year || null,
          rating: editForm.rating ?? null,
        } : m)
      )
      setToast({ isOpen: true, message: '회원 정보가 수정되었습니다.', type: 'success' })
      setEditModalOpen(false)
    } finally {
      setEditSaving(false)
    }
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
        prev.map((m) => (m.id === member.id ? { ...m, status: 'ACTIVE' as const } : m))
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
          {(['all', 'registered', 'unregistered', 'removed'] as MemberFilter[]).map((f) => {
            const label = { all: '전체', registered: '가입회원', unregistered: '비가입회원', removed: `제거/탈퇴${removedCount > 0 ? ` (${removedCount})` : ''}` }[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-(--accent-color) text-(--bg-primary)'
                    : 'text-(--text-muted) hover:text-(--text-primary)'
                }`}
              >
                {label}
              </button>
            )
          })}
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
                    <button
                      onClick={() => openEditModal(member)}
                      className="font-medium text-(--text-primary) hover:text-(--accent-color) hover:underline transition-colors text-left"
                    >
                      {member.name}
                    </button>
                    <Badge variant={ROLE_BADGE[member.role].variant}>
                      {ROLE_BADGE[member.role].label}
                    </Badge>
                    <span className={`text-xs ${member.is_registered ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                      {member.is_registered ? '가입회원' : '비가입회원'}
                    </span>
                    {member.status === 'INVITED' && (
                      <span className="text-xs text-amber-500">초대됨</span>
                    )}
                    {member.status === 'REMOVED' && (
                      <Badge variant="danger">제거됨</Badge>
                    )}
                    {member.status === 'LEFT' && (
                      <Badge variant="secondary">탈퇴</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-(--text-muted) flex-wrap">
                    {member.phone && <span>{member.phone}</span>}
                    {member.gender && <span>{GENDER_LABEL[member.gender as GenderType]}</span>}
                    {member.birth_date && <span>{member.birth_date}</span>}
                    {member.start_year && <span>{member.start_year}년 입문</span>}
                    {member.rating && <span>레이팅 {member.rating}</span>}
                    {member.status_reason && (member.status === 'REMOVED' || member.status === 'LEFT') && (
                      <span className="text-red-400">사유: {member.status_reason}</span>
                    )}
                  </div>
                </div>

                {/* 제거/탈퇴 회원: 원복 버튼 */}
                {(member.status === 'REMOVED' || member.status === 'LEFT') && (
                  <button
                    onClick={() => handleRestoreMember(member)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    title="원복"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    원복
                  </button>
                )}

                {/* 활성 회원 관리 버튼 (시스템 관리자: 전체, 클럽 관리자: OWNER 제외) */}
                {(isSystemAdmin || member.role !== 'OWNER') && member.status !== 'REMOVED' && member.status !== 'LEFT' && (
                  <div className="flex items-center gap-2">
                    {/* 역할 변경 */}
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as ClubMemberRole)}
                      className="text-xs px-2 py-1 rounded bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none"
                    >
                      {isSystemAdmin && <option value="OWNER">회장</option>}
                      <option value="ADMIN">총무</option>
                      <option value="VICE_PRESIDENT">부회장</option>
                      <option value="ADVISOR">고문</option>
                      <option value="MATCH_DIRECTOR">경기이사</option>
                      <option value="MEMBER">회원</option>
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

      {/* 회원 상세/수정 모달 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditMember(null); setEditErrors({}) }}
        title="회원 정보 수정"
        size="lg"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                ref={(el) => { editFieldRefs.current.name = el }}
                type="text"
                value={editForm.name}
                onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); setEditErrors((prev) => ({ ...prev, name: undefined })) }}
                maxLength={100}
                className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                  editErrors.name ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                }`}
              />
              {editErrors.name && <p className="mt-1 text-xs text-red-500">{editErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">생년월일</label>
                <input
                  ref={(el) => { editFieldRefs.current.birth_date = el }}
                  type="text"
                  value={editForm.birth_date || ''}
                  onChange={(e) => { setEditForm({ ...editForm, birth_date: e.target.value }); setEditErrors((prev) => ({ ...prev, birth_date: undefined })) }}
                  placeholder="YYYY-MM"
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    editErrors.birth_date ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {editErrors.birth_date && <p className="mt-1 text-xs text-red-500">{editErrors.birth_date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">성별</label>
                <div className="flex gap-4 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-gender"
                      checked={editForm.gender === 'MALE'}
                      onChange={() => setEditForm({ ...editForm, gender: 'MALE' })}
                      className="accent-(--accent-color)"
                    />
                    <span className="text-sm text-(--text-primary)">남성</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-gender"
                      checked={editForm.gender === 'FEMALE'}
                      onChange={() => setEditForm({ ...editForm, gender: 'FEMALE' })}
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
                ref={(el) => { editFieldRefs.current.phone = el }}
                type="text"
                value={editForm.phone || ''}
                onChange={(e) => { setEditForm({ ...editForm, phone: e.target.value }); setEditErrors((prev) => ({ ...prev, phone: undefined })) }}
                placeholder="010-1234-5678"
                className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                  editErrors.phone ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                }`}
              />
              {editErrors.phone && <p className="mt-1 text-xs text-red-500">{editErrors.phone}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">테니스 입문년도</label>
                <input
                  ref={(el) => { editFieldRefs.current.start_year = el }}
                  type="text"
                  value={editForm.start_year || ''}
                  onChange={(e) => { setEditForm({ ...editForm, start_year: e.target.value }); setEditErrors((prev) => ({ ...prev, start_year: undefined })) }}
                  placeholder="2020"
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    editErrors.start_year ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {editErrors.start_year && <p className="mt-1 text-xs text-red-500">{editErrors.start_year}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-1">레이팅</label>
                <input
                  ref={(el) => { editFieldRefs.current.rating = el }}
                  type="number"
                  value={editForm.rating || ''}
                  onChange={(e) => {
                    setEditForm({ ...editForm, rating: e.target.value ? Number(e.target.value) : undefined })
                    setEditErrors((prev) => ({ ...prev, rating: undefined }))
                  }}
                  placeholder="1~9999"
                  min={1}
                  max={9999}
                  className={`w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
                    editErrors.rating ? 'border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                  }`}
                />
                {editErrors.rating && <p className="mt-1 text-xs text-red-500">{editErrors.rating}</p>}
              </div>
            </div>
            {/* 읽기 전용 정보 */}
            {editMember && (
              <div className="pt-3 border-t border-(--border-color) space-y-1 text-xs text-(--text-muted)">
                <p>역할: {ROLE_BADGE[editMember.role].label} · 상태: {editMember.status === 'ACTIVE' ? '활성' : editMember.status}</p>
                <p>{editMember.is_registered ? '가입회원' : '비가입회원'}{editMember.joined_at ? ` · 가입일: ${new Date(editMember.joined_at).toLocaleDateString('ko-KR')}` : ''}</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => { setEditModalOpen(false); setEditMember(null); setEditErrors({}) }}
            className="btn-secondary btn-sm flex-1"
          >
            취소
          </button>
          <button
            onClick={handleEditSave}
            disabled={editSaving}
            className={`btn-primary btn-sm flex-1 ${editSaving ? 'opacity-50' : ''}`}
          >
            {editSaving ? '저장 중...' : '저장'}
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
