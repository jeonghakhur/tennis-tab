'use client'

import { useState } from 'react'
import { Badge } from '@/components/common/Badge'
import type { SessionAttendanceDetail, AttendanceStatus, ClubSessionGuest } from '@/lib/clubs/types'
import { addSessionGuest, removeSessionGuest } from '@/lib/clubs/session-actions'
import { AlertDialog } from '@/components/common/AlertDialog'
import SessionTimePicker from './SessionTimePicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const statusLabel: Record<AttendanceStatus, { text: string; variant: 'success' | 'secondary' | 'warning' }> = {
  ATTENDING: { text: '참석', variant: 'success' },
  NOT_ATTENDING: { text: '불참', variant: 'secondary' },
  UNDECIDED: { text: '미정', variant: 'warning' },
}

interface AttendanceListProps {
  attendances: SessionAttendanceDetail[]
  guests?: ClubSessionGuest[]
  sessionId: string
  /** 세션 시작/종료 시간 (게스트 시간 선택 기본값용) */
  sessionStartTime?: string
  sessionEndTime?: string
  myMemberId?: string
  canRespond?: boolean
  isOfficer?: boolean
  onEdit?: () => void
  onGuestsChange?: () => void
}

export default function AttendanceList({
  attendances,
  guests = [],
  sessionId,
  sessionStartTime,
  sessionEndTime,
  myMemberId,
  canRespond,
  isOfficer,
  onEdit,
  onGuestsChange,
}: AttendanceListProps) {
  const attending = attendances.filter((a) => a.status === 'ATTENDING')
  const notAttending = attendances.filter((a) => a.status === 'NOT_ATTENDING')
  const undecided = attendances.filter((a) => a.status === 'UNDECIDED')

  const [showAddGuest, setShowAddGuest] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestGender, setGuestGender] = useState<'MALE' | 'FEMALE' | ''>('')
  const [guestFrom, setGuestFrom] = useState(sessionStartTime?.slice(0, 5) || '')
  const [guestUntil, setGuestUntil] = useState(sessionEndTime?.slice(0, 5) || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const resetGuestForm = () => {
    setGuestName('')
    setGuestGender('')
    setGuestFrom(sessionStartTime?.slice(0, 5) || '')
    setGuestUntil(sessionEndTime?.slice(0, 5) || '')
  }

  const handleAddGuest = async () => {
    const name = guestName.trim()
    if (!name) {
      setAlert({ isOpen: true, message: '게스트 이름을 입력해주세요.', type: 'error' })
      return
    }
    setIsSubmitting(true)
    const { error } = await addSessionGuest(sessionId, {
      name,
      gender: guestGender || null,
      available_from: guestFrom || null,
      available_until: guestUntil || null,
    })
    setIsSubmitting(false)
    if (error) {
      setAlert({ isOpen: true, message: error, type: 'error' })
      return
    }
    resetGuestForm()
    setShowAddGuest(false)
    onGuestsChange?.()
  }

  const handleRemoveGuest = async (guestId: string) => {
    const { error } = await removeSessionGuest(guestId)
    if (error) {
      setAlert({ isOpen: true, message: error, type: 'error' })
      return
    }
    onGuestsChange?.()
  }

  const renderRow = (a: SessionAttendanceDetail) => {
    const config = statusLabel[a.status]
    const isMe = a.club_member_id === myMemberId

    return (
      <div key={a.id} className={`rounded-lg ${isMe ? 'bg-emerald-500/10' : ''}`}>
        <div className="flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-(--text-primary) truncate">
              {a.member.name}
              {isMe && <span className="text-xs text-(--text-muted) ml-1">(나)</span>}
            </span>
            {a.member.rating && (
              <span className="text-xs text-(--text-muted)">{a.member.rating}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {a.status === 'ATTENDING' && (a.available_from || a.available_until) && (
              <span className="text-xs text-(--text-muted)">
                {a.available_from?.slice(0, 5) || '?'} ~ {a.available_until?.slice(0, 5) || '?'}
              </span>
            )}
            <Badge variant={config.variant}>{config.text}</Badge>
            {isMe && canRespond && onEdit && (
              <button
                onClick={onEdit}
                className="text-xs px-3 py-2 rounded border font-medium min-h-[36px]"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
              >
                수정
              </button>
            )}
          </div>
        </div>
        {a.notes && (
          <p className="text-xs px-3 pb-2" style={{ color: 'var(--text-muted)' }}>
            💬 {a.notes}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-(--text-primary)">참석 현황</h3>
        <div className="flex gap-2 text-xs">
          <span className="text-emerald-400">참석 {attending.length}</span>
          <span className="text-gray-400">불참 {notAttending.length}</span>
          {undecided.length > 0 && <span className="text-amber-400">미정 {undecided.length}</span>}
        </div>
      </div>

      {attendances.length === 0 ? (
        <p className="text-sm text-(--text-muted) py-4 text-center">
          아직 응답이 없습니다.
        </p>
      ) : (
        <div className="space-y-1">
          {/* 참석 → 미정 → 불참 순 */}
          {attending.map(renderRow)}
          {undecided.map(renderRow)}
          {notAttending.map(renderRow)}
        </div>
      )}

      {/* 게스트 섹션 (임원만 표시) */}
      {isOfficer && (
        <div className="mt-4 pt-4 border-t border-(--border-color)">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-(--text-primary)">
              게스트
              {guests.length > 0 && (
                <span className="ml-1.5 text-xs text-(--text-muted)">({guests.length}명)</span>
              )}
            </h4>
            {!showAddGuest && (
              <button
                onClick={() => setShowAddGuest(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium"
              >
                + 게스트 추가
              </button>
            )}
          </div>

          {/* 게스트 목록 */}
          {guests.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg">
              <div className="flex items-center gap-2">
                {/* Badge 컴포넌트 사용 — 명도 대비 보장 */}
                <Badge variant="warning">게스트</Badge>
                <span className="text-sm font-medium text-(--text-primary)">{g.name}</span>
                {g.gender && (
                  <span className="text-xs text-(--text-muted)">
                    {g.gender === 'MALE' ? '남' : '여'}
                  </span>
                )}
                {(g.available_from || g.available_until) && (
                  <span className="text-xs text-(--text-muted)">
                    {g.available_from?.slice(0, 5) || '?'} ~ {g.available_until?.slice(0, 5) || '?'}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleRemoveGuest(g.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                aria-label={`${g.name} 게스트 삭제`}
              >
                삭제
              </button>
            </div>
          ))}

          {/* 게스트 추가 폼 */}
          {showAddGuest && (
            <div className="mt-2 p-3 rounded-lg border border-(--border-color) space-y-3">
              {/* 이름 */}
              <div>
                <label htmlFor="guest-name" className="block text-sm text-(--text-muted) mb-1">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="게스트 이름"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-color) bg-(--bg-secondary) text-(--text-primary) focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                  autoFocus
                />
              </div>

              {/* 성별 — shadcn Select 컴포넌트 사용 */}
              <div>
                <label className="block text-sm text-(--text-muted) mb-1">
                  성별
                </label>
                <Select value={guestGender} onValueChange={(v) => setGuestGender(v as 'MALE' | 'FEMALE' | '')}>
                  <SelectTrigger
                    className="w-full h-10 px-3 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <SelectItem value="" style={{ color: 'var(--text-muted)' }}>미지정</SelectItem>
                    <SelectItem value="MALE" style={{ color: 'var(--text-primary)' }}>남</SelectItem>
                    <SelectItem value="FEMALE" style={{ color: 'var(--text-primary)' }}>여</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 참석 가능 시간 */}
              <div>
                <label className="block text-sm text-(--text-muted) mb-1.5">
                  참석 가능 시간
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SessionTimePicker
                      value={guestFrom}
                      onChange={setGuestFrom}
                      placeholder="시작"
                    />
                  </div>
                  <span className="text-sm shrink-0 text-(--text-muted)">~</span>
                  <div className="flex-1">
                    <SessionTimePicker
                      value={guestUntil}
                      onChange={setGuestUntil}
                      placeholder="종료"
                    />
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddGuest(false); resetGuestForm() }}
                  className="flex-1 py-2 text-sm rounded-lg border border-(--border-color) text-(--text-muted)"
                >
                  취소
                </button>
                <button
                  onClick={handleAddGuest}
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium disabled:opacity-50"
                >
                  {isSubmitting ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
    </div>
  )
}
