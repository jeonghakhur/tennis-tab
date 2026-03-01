'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import AttendanceForm from '@/components/clubs/sessions/AttendanceForm'
import AttendanceList from '@/components/clubs/sessions/AttendanceList'
import MatchBoard from '@/components/clubs/sessions/MatchBoard'
import { getSessionPageData } from '@/lib/clubs/session-actions'
import type {
  ClubSessionDetail,
  ClubSessionStatus,
  ClubMemberRole,
} from '@/lib/clubs/types'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import SessionForm from '@/components/clubs/sessions/SessionForm'
import { cancelClubSession } from '@/lib/clubs/session-actions'

const statusConfig: Record<ClubSessionStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '모집중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'secondary' },
  CANCELLED: { label: '취소', variant: 'danger' },
  COMPLETED: { label: '완료', variant: 'info' },
}

export default function SessionDetailPage() {
  const { id: clubId, sessionId } = useParams<{ id: string; sessionId: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [session, setSession] = useState<ClubSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [myMemberId, setMyMemberId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<ClubMemberRole | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [deleting, setDeleting] = useState(false)
  const [editAttendance, setEditAttendance] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { session, myMemberId, myRole } = await getSessionPageData(sessionId, clubId)
    setSession(session)
    setMyMemberId(myMemberId)
    setMyRole(myRole)
    setLoading(false)
  }, [sessionId, clubId])

  useEffect(() => {
    if (sessionId) fetchData()
  }, [sessionId, fetchData])

  const isOfficer = myRole && ['OWNER', 'ADMIN', 'MATCH_DIRECTOR'].includes(myRole)

  const handleDelete = async () => {
    setConfirmDelete(false)
    setDeleting(true)
    const result = await cancelClubSession(sessionId)
    setDeleting(false)
    if (result.error) {
      setToast({ isOpen: true, message: result.error || '오류가 발생했습니다.', type: 'success' as const })
    } else {
      router.push(`/clubs/${clubId}`)
    }
  }

  // 내 참석 응답
  const myAttendance = session?.attendances.find(
    (a) => a.club_member_id === myMemberId
  )

  // 응답 가능 여부
  const canRespond = session?.status === 'OPEN' && myMemberId

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-64 w-full rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Navigation />
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="text-center">
            <h1 className="text-2xl font-display mb-4" style={{ color: 'var(--text-primary)' }}>
              세션을 찾을 수 없습니다
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

  const config = statusConfig[session.status]
  const dateObj = new Date(session.session_date + 'T00:00:00')
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const formattedDate = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`
  const timeRange = `${session.start_time.slice(0, 5)} ~ ${session.end_time.slice(0, 5)}`

  return (
    <>
      <Navigation />
      <div style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* 뒤로가기 */}
          <Link
            href={`/clubs/${clubId}`}
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            클럽으로
          </Link>

          {/* 세션 헤더 */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-display" style={{ color: 'var(--text-primary)' }}>
                {session.title}
              </h1>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>

            <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🕐</span>
                <span>{timeRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span>{session.venue_name}</span>
                {session.court_numbers.length > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    ({session.court_numbers.join(', ')})
                  </span>
                )}
              </div>
              {session.max_attendees && (
                <div className="flex items-center gap-2">
                  <span>👥</span>
                  <span>정원 {session.max_attendees}명</span>
                </div>
              )}
              {session.rsvp_deadline && (
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span>
                    마감: {new Date(session.rsvp_deadline).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') + ' ' + new Date(session.rsvp_deadline).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) /* suppressHydrationWarning placeholder */
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            {session.notes && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {session.notes}
                </p>
              </div>
            )}

            {/* 임원 액션 */}
            {isOfficer && session?.status === 'OPEN' && (
              <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-(--border-color) text-(--text-primary) hover:bg-(--bg-card-hover) transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  수정
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>

          {/* 참석 응답 — 미응답이거나 수정 모드일 때만 표시 */}
          {canRespond && (!myAttendance || editAttendance) && (
            <AttendanceForm
              sessionId={sessionId}
              clubMemberId={myMemberId!}
              currentStatus={myAttendance?.status}
              currentFrom={myAttendance?.available_from}
              currentUntil={myAttendance?.available_until}
              currentNotes={myAttendance?.notes}
              sessionStartTime={session?.start_time}
              sessionEndTime={session?.end_time}
              isEditMode={editAttendance}
              onResponded={() => { setEditAttendance(false); fetchData() }}
            />
          )}

          {/* 참석자 현황 */}
          <AttendanceList
            attendances={session.attendances}
            myMemberId={myMemberId || undefined}
            canRespond={!!canRespond && !editAttendance}
            onEdit={() => setEditAttendance(true)}
          />

          {/* 대진표 */}
          {session.matches.length > 0 && (
            <MatchBoard
              matches={session.matches}
              myMemberId={myMemberId || undefined}
              onRefresh={fetchData}
            />
          )}
        </div>
      </div>
      {/* 수정 폼 */}
      {session && (
        <SessionForm
          clubId={clubId}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onCreated={() => { setEditOpen(false); fetchData() }}
          session={session as unknown as import('@/lib/clubs/types').ClubSession}
        />
      )}

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="모임 삭제"
        message="이 모임을 삭제(취소)하시겠습니까?"
        type="warning"
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}
