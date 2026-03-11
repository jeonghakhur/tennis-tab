'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/common/Badge'
import { Lock, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { AlertDialog, ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import AttendanceList from '@/components/clubs/sessions/AttendanceList'
import BracketEditor from '@/components/clubs/sessions/BracketEditor'
import {
  getSessionPageData,
  closeSessionRsvp,
  completeSession,
  cancelClubSession,
  changeSessionStatus,
} from '@/lib/clubs/session-actions'
import type { ClubSessionDetail, ClubMemberRole } from '@/lib/clubs/types'
import { ChevronLeft } from 'lucide-react'

export default function SessionManagePage() {
  const { id: clubId, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()

  const [session, setSession] = useState<ClubSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [myMemberId, setMyMemberId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<ClubMemberRole | null>(null)

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean
    message: string
    action: () => Promise<void>
  }>({ isOpen: false, message: '', action: async () => {} })

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { session, myMemberId, myRole } = await getSessionPageData(sessionId, clubId)
    setSession(session)
    setMyMemberId(myMemberId)
    setMyRole(myRole)
    if (!silent) setLoading(false)
  }, [sessionId, clubId])

  useEffect(() => {
    if (sessionId) fetchData()
  }, [sessionId, fetchData])

  const isOfficer = myRole && ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'].includes(myRole)

  // 응답 마감
  const handleCloseRsvp = () => {
    setConfirmAction({
      isOpen: true,
      message: '응답을 마감하시겠습니까? 마감 후 회원들은 응답을 변경할 수 없습니다.',
      action: async () => {
        setActionLoading(true)
        const result = await closeSessionRsvp(sessionId)
        setActionLoading(false)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
        } else {
          setToast({ isOpen: true, message: '응답이 마감되었습니다.', type: 'success' })
          fetchData()
        }
      },
    })
  }

  // 모임 완료
  const handleComplete = () => {
    setConfirmAction({
      isOpen: true,
      message: '모임을 완료 처리하시겠습니까? 참석자 통계가 갱신됩니다.',
      action: async () => {
        setActionLoading(true)
        const result = await completeSession(sessionId)
        setActionLoading(false)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
        } else {
          setToast({ isOpen: true, message: '모임이 완료되었습니다.', type: 'success' })
          fetchData()
        }
      },
    })
  }

  // 모임 취소
  const handleCancel = () => {
    setConfirmAction({
      isOpen: true,
      message: '모임을 취소하시겠습니까?',
      action: async () => {
        setActionLoading(true)
        const result = await cancelClubSession(sessionId)
        setActionLoading(false)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
        } else {
          setToast({ isOpen: true, message: '모임이 취소되었습니다.', type: 'success' })
          fetchData()
        }
      },
    })
  }

  const handleStatusChange = async (newStatus: 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED') => {
    const labels: Record<string, string> = {
      OPEN: '모집중',
      CLOSED: '마감',
      COMPLETED: '완료',
      CANCELLED: '취소',
    }
    setConfirmAction({
      isOpen: true,
      message: `상태를 "${labels[newStatus]}"(으)로 변경하시겠습니까?`,
      action: async () => {
        setActionLoading(true)
        const result = await changeSessionStatus(sessionId, newStatus)
        setActionLoading(false)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
        } else {
          setToast({ isOpen: true, message: `상태가 "${labels[newStatus]}"(으)로 변경되었습니다.`, type: 'success' })
          fetchData()
        }
      },
    })
  }

  if (loading) {
    return (
      <>
        <div style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-content mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!session || !isOfficer) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="text-center">
            <h1 className="text-2xl font-display mb-4" style={{ color: 'var(--text-primary)' }}>
              {!session ? '모임을 찾을 수 없습니다' : '관리 권한이 없습니다'}
            </h1>
            <Link
              href={`/clubs/${clubId}`}
              className="text-sm hover:underline"
              style={{ color: 'var(--accent-color)' }}
            >
              클럽으로 돌아가기
            </Link>
          </div>
        </div>
      </>
    )
  }

  const attendingMembers = session.attendances.filter((a) => a.status === 'ATTENDING')

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <div style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12 space-y-6">
          {/* 뒤로가기 */}
          <Link
            href={`/clubs/${clubId}/sessions/${sessionId}`}
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            모임 상세로
          </Link>

          {/* 모임 헤더 */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-display mb-1" style={{ color: 'var(--text-primary)' }}>
                  {session.title} — 관리
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {session.session_date} | {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
                </p>
              </div>
              <Badge
                variant={
                  session.status === 'OPEN' ? 'success' :
                  session.status === 'CLOSED' ? 'secondary' :
                  session.status === 'COMPLETED' ? 'info' : 'danger'
                }
              >
                {session.status}
              </Badge>
            </div>

            {/* 관리 액션 버튼 */}
            <div className="flex flex-wrap gap-2">
              {session.status !== 'OPEN' && (
                <button
                  onClick={() => handleStatusChange('OPEN')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--color-success-border)', color: 'var(--color-success)', backgroundColor: 'var(--color-success-subtle)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  모집중으로
                </button>
              )}
              {session.status === 'OPEN' && (
                <button
                  onClick={handleCloseRsvp}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--color-warning-border)', color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-subtle)' }}
                >
                  <Lock className="w-4 h-4" />
                  응답 마감
                </button>
              )}
              {session.status !== 'COMPLETED' && (
                <button
                  onClick={() => handleStatusChange('COMPLETED')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--color-success-border)', color: 'var(--color-success)', backgroundColor: 'var(--color-success-subtle)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  모임 완료
                </button>
              )}
              {session.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleStatusChange('CANCELLED')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-subtle)' }}
                >
                  <XCircle className="w-4 h-4" />
                  모임 취소
                </button>
              )}
            </div>
          </div>

          {/* 참석자 목록 (임원: 게스트 섹션 포함) */}
          <AttendanceList
            attendances={session.attendances}
            guests={session.guests}
            sessionId={sessionId}
            sessionStartTime={session.start_time}
            sessionEndTime={session.end_time}
            myMemberId={myMemberId || undefined}
            isOfficer={!!isOfficer}
            onGuestsChange={() => fetchData(true)}
          />

          {/* 대진 편성 (CLOSED 또는 OPEN 상태) */}
          {session.status !== 'CANCELLED' && (
            <BracketEditor
              sessionId={sessionId}
              attendingMembers={attendingMembers}
              guests={session.guests}
              matches={session.matches}
              courtNumbers={session.court_numbers}
              onRefresh={() => fetchData(true)}
            />
          )}
        </div>
      </div>

      {/* 다이얼로그 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
        onConfirm={async () => {
          setConfirmAction({ ...confirmAction, isOpen: false })
          await confirmAction.action()
        }}
        message={confirmAction.message}
        type="warning"
      />
    </>
  )
}
