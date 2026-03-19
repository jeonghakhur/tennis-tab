'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, BookOpen, Calendar, MessageSquare, GraduationCap, ClipboardList } from 'lucide-react'
import { CoachList } from '@/components/clubs/coaches/CoachList'
import { AdminProgramTab } from '@/components/admin/lessons/AdminProgramTab'
import { AdminSlotTab } from '@/components/admin/lessons/AdminSlotTab'
import { AdminBookingTab } from '@/components/admin/lessons/AdminBookingTab'
import { AdminInquiryTab } from '@/components/admin/lessons/AdminInquiryTab'
import { AdminEnrollmentTab } from '@/components/admin/lessons/AdminEnrollmentTab'
import { getAllLessonPrograms } from '@/lib/lessons/actions'
import { getCurrentUser } from '@/lib/auth/actions'
import type { LessonProgram } from '@/lib/lessons/types'

type Tab = 'coaches' | 'programs' | 'slots' | 'bookings' | 'enrollments' | 'inquiries'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'coaches', label: '코치', icon: Users },
  { key: 'programs', label: '프로그램', icon: BookOpen },
  { key: 'slots', label: '슬롯', icon: Calendar },
  { key: 'bookings', label: '예약', icon: ClipboardList },
  { key: 'enrollments', label: '수강생', icon: GraduationCap },
  { key: 'inquiries', label: '문의', icon: MessageSquare },
]

export default function AdminLessonsPage() {
  const [tab, setTab] = useState<Tab>('coaches')
  const [programs, setPrograms] = useState<LessonProgram[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true)
    const { data } = await getAllLessonPrograms()
    setPrograms(data)
    setProgramsLoading(false)
  }, [])

  useEffect(() => {
    loadPrograms()
    getCurrentUser().then((user) => {
      if (user?.role === 'SUPER_ADMIN') setIsSuperAdmin(true)
    })
  }, [loadPrograms])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          레슨 관리
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          코치, 프로그램, 일정 슬롯, 문의를 관리합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
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
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* 탭 패널 */}
      <div id="tabpanel-coaches" role="tabpanel" hidden={tab !== 'coaches'}>
        {tab === 'coaches' && <CoachList clubId="" isAdmin={true} />}
      </div>

      <div id="tabpanel-programs" role="tabpanel" hidden={tab !== 'programs'}>
        {tab === 'programs' && (
          <AdminProgramTab
            programs={programs}
            loading={programsLoading}
            onRefresh={loadPrograms}
          />
        )}
      </div>

      <div id="tabpanel-slots" role="tabpanel" hidden={tab !== 'slots'}>
        {tab === 'slots' && (
          <AdminSlotTab
            programs={programs}
            programsLoading={programsLoading}
          />
        )}
      </div>

      <div id="tabpanel-bookings" role="tabpanel" hidden={tab !== 'bookings'}>
        {tab === 'bookings' && <AdminBookingTab isSuperAdmin={isSuperAdmin} />}
      </div>

      <div id="tabpanel-enrollments" role="tabpanel" hidden={tab !== 'enrollments'}>
        {tab === 'enrollments' && (
          <AdminEnrollmentTab
            programs={programs}
            programsLoading={programsLoading}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </div>

      <div id="tabpanel-inquiries" role="tabpanel" hidden={tab !== 'inquiries'}>
        {tab === 'inquiries' && <AdminInquiryTab isSuperAdmin={isSuperAdmin} />}
      </div>
    </div>
  )
}
