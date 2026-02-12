'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Club, ClubMember, ClubMemberRole, ClubMemberStatus } from '@/lib/clubs/types'
import { updateClub } from '@/lib/clubs/actions'
import { ClubMemberList } from './ClubMemberList'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { AssociationCombobox, type AssociationValue } from './AssociationCombobox'

interface ClubDetailTabsProps {
  club: Club
  initialMembers: ClubMember[]
  associations?: Array<{ id: string; name: string }>
}

type Tab = 'info' | 'members'

const ROLE_LABEL: Record<ClubMemberRole, string> = {
  OWNER: '소유자',
  ADMIN: '관리자',
  MEMBER: '회원',
}

const STATUS_LABEL: Record<ClubMemberStatus, string> = {
  PENDING: '승인 대기',
  INVITED: '초대됨',
  ACTIVE: '활성',
  LEFT: '탈퇴',
  REMOVED: '제거됨',
}

export function ClubDetailTabs({ club, initialMembers, associations = [] }: ClubDetailTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

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
        </div>
      ) : (
        <ClubMemberList clubId={club.id} initialMembers={initialMembers} />
      )}

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </>
  )
}
