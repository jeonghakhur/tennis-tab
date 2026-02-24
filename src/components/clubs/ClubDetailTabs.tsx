'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Club, ClubMember, ClubMemberRole, ClubMemberStatus } from '@/lib/clubs/types'
import { updateClub, deleteClub, permanentlyDeleteClub, reactivateClub } from '@/lib/clubs/actions'
import { ClubMemberList } from './ClubMemberList'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Modal } from '@/components/common/Modal'
import { AssociationCombobox, type AssociationValue } from './AssociationCombobox'

interface ClubDetailTabsProps {
  club: Club
  initialMembers: ClubMember[]
  associations?: Array<{ id: string; name: string }>
  isSystemAdmin?: boolean
}

type Tab = 'info' | 'members'

const ROLE_LABEL: Record<ClubMemberRole, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  VICE_PRESIDENT: '부회장',
  ADVISOR: '고문',
  MATCH_DIRECTOR: '경기이사',
  MEMBER: '회원',
}

const STATUS_LABEL: Record<ClubMemberStatus, string> = {
  PENDING: '승인 대기',
  INVITED: '초대됨',
  ACTIVE: '활성',
  LEFT: '탈퇴',
  REMOVED: '제거됨',
}

export function ClubDetailTabs({ club, initialMembers, associations = [], isSystemAdmin = false }: ClubDetailTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  // 삭제 확인 모달
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'deactivate' | 'permanent'
  }>({ isOpen: false, type: 'deactivate' })
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  // 클럽 정보 수정 폼 상태
  const [infoForm, setInfoForm] = useState({
    name: club.name,
    description: club.description || '',
    city: club.city || '',
    district: club.district || '',
    address: club.address || '',
    contact_phone: club.contact_phone || '',
    contact_email: club.contact_email || '',
    association_id: club.association_id as string | null,
    association_name: '',
  })
  const [assocValue, setAssocValue] = useState<AssociationValue>({
    association_id: club.association_id,
    association_name: (club.associations as { name: string } | null)?.name || '',
  })

  const handleAssocChange = (val: AssociationValue) => {
    setAssocValue(val)
    if (val.association_id) {
      setInfoForm((prev) => ({ ...prev, association_id: val.association_id, association_name: '' }))
    } else if (val.association_name) {
      setInfoForm((prev) => ({ ...prev, association_id: null, association_name: val.association_name }))
    } else {
      setInfoForm((prev) => ({ ...prev, association_id: null, association_name: '' }))
    }
  }

  const handleInfoSave = async () => {
    setLoading(true)
    try {
      const result = await updateClub(club.id, infoForm)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      setToast({ isOpen: true, message: '클럽 정보가 수정되었습니다.', type: 'success' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // 삭제 모달 열기
  const openDeleteModal = (type: 'deactivate' | 'permanent') => {
    setDeleteConfirmName('')
    setDeleteModal({ isOpen: true, type })
  }

  const closeDeleteModal = () => {
    setDeleteModal((prev) => ({ ...prev, isOpen: false }))
    setDeleteConfirmName('')
  }

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (deleteConfirmName !== club.name) return

    closeDeleteModal()
    setLoading(true)
    try {
      const result = deleteModal.type === 'permanent'
        ? await permanentlyDeleteClub(club.id)
        : await deleteClub(club.id)

      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      const msg = deleteModal.type === 'permanent' ? '클럽이 영구 삭제되었습니다.' : '클럽이 비활성화되었습니다.'
      setToast({ isOpen: true, message: msg, type: 'success' })
      router.push('/admin/clubs')
    } finally {
      setLoading(false)
    }
  }

  // 클럽 활성화
  const handleReactivateClub = async () => {
    setLoading(true)
    try {
      const result = await reactivateClub(club.id)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      setToast({ isOpen: true, message: '클럽이 활성화되었습니다.', type: 'success' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'info' as Tab, label: '클럽 정보' },
    { id: 'members' as Tab, label: `회원 관리 (${initialMembers.filter((m) => m.status === 'ACTIVE').length})` },
  ]

  return (
    <>
      {loading && <LoadingOverlay message="저장 중..." />}

      {/* 탭 헤더 */}
      <div className="flex border-b border-(--border-color)">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-(--accent-color)'
                : 'text-(--text-muted) hover:text-(--text-primary)'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color)" />
            )}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'info' ? (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">클럽 이름</label>
            <input
              type="text"
              value={infoForm.name}
              onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
          {/* 소속 협회 */}
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              소속 협회
            </label>
            <AssociationCombobox
              associations={associations}
              value={assocValue}
              onChange={handleAssocChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">시/도</label>
              <input
                type="text"
                value={infoForm.city}
                onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">구/군</label>
              <input
                type="text"
                value={infoForm.district}
                onChange={(e) => setInfoForm({ ...infoForm, district: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">상세 주소</label>
            <input
              type="text"
              value={infoForm.address}
              onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">연락처</label>
              <input
                type="text"
                value={infoForm.contact_phone}
                onChange={(e) => setInfoForm({ ...infoForm, contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">이메일</label>
              <input
                type="email"
                value={infoForm.contact_email}
                onChange={(e) => setInfoForm({ ...infoForm, contact_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">클럽 소개</label>
            <textarea
              value={infoForm.description}
              onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button onClick={handleInfoSave} className="btn-primary btn-sm">
              저장
            </button>
          </div>

          {/* 비활성 클럽: 활성화 안내 */}
          {!club.is_active && (
            <div className="pt-5 mt-5 border-t border-(--border-color)">
              <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div>
                  <p className="text-sm font-medium text-amber-500">이 클럽은 비활성 상태입니다</p>
                  <p className="text-xs text-(--text-muted) mt-0.5">공개 목록에 표시되지 않습니다. 활성화하면 다시 노출됩니다.</p>
                </div>
                <button
                  onClick={handleReactivateClub}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                >
                  클럽 활성화
                </button>
              </div>
            </div>
          )}

          {/* 클럽 삭제 영역 */}
          <div className="pt-5 mt-5 border-t border-(--border-color)">
            <h3 className="text-sm font-medium text-red-500 mb-2">위험 영역</h3>
            {club.is_active && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-(--text-muted)">
                클럽을 비활성화하면 목록에서 숨겨집니다.
              </p>
              <button
                onClick={() => openDeleteModal('deactivate')}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
              >
                클럽 비활성화
              </button>
            </div>
            )}
            {isSystemAdmin && (
              <div className="flex items-center justify-between gap-4 mt-3">
                <p className="text-xs text-(--text-muted)">
                  영구 삭제 시 모든 회원 데이터가 함께 삭제되며 복구할 수 없습니다.
                </p>
                <button
                  onClick={() => openDeleteModal('permanent')}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  영구 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <ClubMemberList clubId={club.id} initialMembers={initialMembers} isSystemAdmin={isSystemAdmin} />
      )}

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />

      {/* 삭제 확인 모달 — 클럽 이름 직접 입력 */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        title={deleteModal.type === 'permanent' ? '클럽 영구 삭제' : '클럽 비활성화'}
        size="md"
      >
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-sm text-(--text-secondary)">
              {deleteModal.type === 'permanent'
                ? '모든 회원 데이터가 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.'
                : '클럽이 목록에서 숨겨지며, 관리자가 복구할 수 있습니다.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">
                확인을 위해 클럽 이름을 입력해주세요
              </label>
              <p className="text-xs text-(--text-muted) mb-2">
                <span className="font-medium text-(--text-primary)">{club.name}</span>을(를) 정확히 입력하세요
              </p>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={club.name}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-red-500 outline-none"
                aria-label="클럽 이름 확인 입력"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={closeDeleteModal} className="btn-secondary btn-sm flex-1">
            취소
          </button>
          <button
            onClick={handleDeleteConfirm}
            disabled={deleteConfirmName !== club.name}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              deleteConfirmName === club.name
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-500/30 text-red-300 cursor-not-allowed'
            }`}
          >
            {deleteModal.type === 'permanent' ? '영구 삭제' : '비활성화'}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
