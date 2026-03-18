'use client'

import { useState } from 'react'
import { Users, Calendar, MessageSquare, ClipboardList, RotateCcw } from 'lucide-react'
import { CoachList } from '@/components/clubs/coaches/CoachList'
import { AdminSlotTab } from '@/components/admin/lessons/AdminSlotTab'
import { AdminBookingTab } from '@/components/admin/lessons/AdminBookingTab'
import { AdminInquiryTab } from '@/components/admin/lessons/AdminInquiryTab'
import { AdminExtensionTab } from '@/components/admin/lessons/AdminExtensionTab'

type Tab = 'coaches' | 'slots' | 'bookings' | 'inquiries' | 'extensions'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'coaches',    label: '코치',     icon: Users },
  { key: 'slots',      label: '슬롯',     icon: Calendar },
  { key: 'bookings',   label: '예약',     icon: ClipboardList },
  { key: 'inquiries',  label: '문의',     icon: MessageSquare },
  { key: 'extensions', label: '연장 신청', icon: RotateCcw },
]

export default function AdminLessonsPage() {
  const [tab, setTab] = useState<Tab>('coaches')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          레슨 관리
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          코치, 슬롯, 예약, 문의를 관리합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="flex border-b mb-6"
        style={{ borderColor: 'var(--border-color)' }}
        role="tablist"
        aria-label="레슨 관리 탭"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.key}`}
              onClick={() => setTab(t.key)}
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

      {/* 탭 패널 */}
      <div id="tabpanel-coaches" role="tabpanel" hidden={tab !== 'coaches'}>
        {tab === 'coaches' && <CoachList clubId="" isAdmin={true} />}
      </div>

      <div id="tabpanel-slots" role="tabpanel" hidden={tab !== 'slots'}>
        {tab === 'slots' && <AdminSlotTab />}
      </div>

      <div id="tabpanel-bookings" role="tabpanel" hidden={tab !== 'bookings'}>
        {tab === 'bookings' && <AdminBookingTab />}
      </div>

      <div id="tabpanel-inquiries" role="tabpanel" hidden={tab !== 'inquiries'}>
        {tab === 'inquiries' && <AdminInquiryTab />}
      </div>

      <div id="tabpanel-extensions" role="tabpanel" hidden={tab !== 'extensions'}>
        {tab === 'extensions' && <AdminExtensionTab />}
      </div>
    </div>
  )
}
