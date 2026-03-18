'use client'

import { useState, useEffect } from 'react'
import { Users, Calendar, MessageSquare, ClipboardList, RotateCcw } from 'lucide-react'
import { CoachList } from '@/components/clubs/coaches/CoachList'
import { AdminSlotTab } from '@/components/admin/lessons/AdminSlotTab'
import { AdminBookingTab } from '@/components/admin/lessons/AdminBookingTab'
import { AdminInquiryTab } from '@/components/admin/lessons/AdminInquiryTab'
import { AdminExtensionTab } from '@/components/admin/lessons/AdminExtensionTab'
import { getMyCoachId } from '@/lib/lessons/slot-actions'

type AdminTab = 'coaches' | 'slots' | 'bookings' | 'inquiries' | 'extensions'
type CoachTab = 'slots' | 'bookings' | 'inquiries' | 'extensions'

const ADMIN_TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'coaches',    label: '코치',     icon: Users },
  { key: 'slots',      label: '슬롯',     icon: Calendar },
  { key: 'bookings',   label: '예약',     icon: ClipboardList },
  { key: 'inquiries',  label: '문의',     icon: MessageSquare },
  { key: 'extensions', label: '연장 신청', icon: RotateCcw },
]

const COACH_TABS: { key: CoachTab; label: string; icon: React.ElementType }[] = [
  { key: 'slots',      label: '내 슬롯',   icon: Calendar },
  { key: 'bookings',   label: '예약 현황', icon: ClipboardList },
  { key: 'inquiries',  label: '문의',      icon: MessageSquare },
  { key: 'extensions', label: '연장 신청', icon: RotateCcw },
]

export default function AdminLessonsPage() {
  const [myCoachId, setMyCoachId] = useState<string | null | undefined>(undefined)
  const [adminTab, setAdminTab] = useState<AdminTab>('coaches')
  const [coachTab, setCoachTab] = useState<CoachTab>('slots')

  useEffect(() => {
    getMyCoachId().then(setMyCoachId)
  }, [])

  // 코치 ID 로딩 중
  if (myCoachId === undefined) return null

  const isCoachMode = myCoachId !== null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          {isCoachMode ? '내 레슨 관리' : '레슨 관리'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isCoachMode ? '본인의 슬롯, 예약, 연장 신청을 확인합니다.' : '코치, 슬롯, 예약, 문의를 관리합니다.'}
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="flex border-b mb-6"
        style={{ borderColor: 'var(--border-color)' }}
        role="tablist"
        aria-label="레슨 관리 탭"
      >
        {(isCoachMode ? COACH_TABS : ADMIN_TABS).map((t) => {
          const Icon = t.icon
          const isActive = isCoachMode ? coachTab === t.key : adminTab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.key}`}
              onClick={() => isCoachMode ? setCoachTab(t.key as CoachTab) : setAdminTab(t.key as AdminTab)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm transition-colors"
              style={{
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 400,
                borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* 어드민 탭 패널 */}
      {!isCoachMode && (
        <>
          <div id="tabpanel-coaches" role="tabpanel" hidden={adminTab !== 'coaches'}>
            {adminTab === 'coaches' && <CoachList clubId="" isAdmin={true} />}
          </div>
          <div id="tabpanel-slots" role="tabpanel" hidden={adminTab !== 'slots'}>
            {adminTab === 'slots' && <AdminSlotTab />}
          </div>
          <div id="tabpanel-bookings" role="tabpanel" hidden={adminTab !== 'bookings'}>
            {adminTab === 'bookings' && <AdminBookingTab />}
          </div>
          <div id="tabpanel-inquiries" role="tabpanel" hidden={adminTab !== 'inquiries'}>
            {adminTab === 'inquiries' && <AdminInquiryTab />}
          </div>
          <div id="tabpanel-extensions" role="tabpanel" hidden={adminTab !== 'extensions'}>
            {adminTab === 'extensions' && <AdminExtensionTab />}
          </div>
        </>
      )}

      {/* 코치 탭 패널 — 본인 데이터만 */}
      {isCoachMode && (
        <>
          <div id="tabpanel-slots" role="tabpanel" hidden={coachTab !== 'slots'}>
            {coachTab === 'slots' && <AdminSlotTab fixedCoachId={myCoachId} />}
          </div>
          <div id="tabpanel-bookings" role="tabpanel" hidden={coachTab !== 'bookings'}>
            {coachTab === 'bookings' && <AdminBookingTab coachId={myCoachId} />}
          </div>
          <div id="tabpanel-inquiries" role="tabpanel" hidden={coachTab !== 'inquiries'}>
            {coachTab === 'inquiries' && <AdminInquiryTab coachId={myCoachId} />}
          </div>
          <div id="tabpanel-extensions" role="tabpanel" hidden={coachTab !== 'extensions'}>
            {coachTab === 'extensions' && <AdminExtensionTab coachId={myCoachId} />}
          </div>
        </>
      )}
    </div>
  )
}
