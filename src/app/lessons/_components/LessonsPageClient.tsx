'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Phone, User, ChevronRight, Loader2, GraduationCap, MessageSquare, MapPin } from 'lucide-react'
import { getPublicOpenSlots, createBooking, getCurrentMemberProfile, createLessonInquiry } from '@/lib/lessons/slot-actions'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import type { Coach } from '@/lib/lessons/types'
import type { LessonSlot } from '@/lib/lessons/slot-types'

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getPerDowTimes(
  sessions: Array<{ slot_date: string; start_time: string; end_time: string }>
): Array<{ dow: number; start: string; end: string }> {
  const seen = new Map<number, { start: string; end: string }>()
  for (const s of sessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!seen.has(dow)) seen.set(dow, { start: s.start_time, end: s.end_time })
  }
  return [...seen.entries()].sort(([a], [b]) => a - b).map(([dow, t]) => ({ dow, ...t }))
}

function getPackageDowLabel(sessions: Array<{ slot_date: string }>, fallback?: string): string {
  const src = sessions.length > 0 ? sessions : fallback ? [{ slot_date: fallback }] : []
  const seen = new Set<number>()
  const dows: number[] = []
  for (const s of src) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!seen.has(dow)) { seen.add(dow); dows.push(dow) }
  }
  return dows.map((d) => DAY_LABELS[d]).join('·')
}

// ─── PublicSlotCard ───────────────────────────────────────────────────────────

interface PublicSlotCardProps {
  slot: LessonSlot
  onBook: (slot: LessonSlot) => void
}

function PublicSlotCard({ slot, onBook }: PublicSlotCardProps) {
  const sessions = slot.sessions ?? []
  const dowTimes = getPerDowTimes(sessions)
  const dowLabel = getPackageDowLabel(sessions, slot.slot_date)
  const title = slot.frequency ? `${dowLabel} 주${slot.frequency}회 레슨 패키지` : `${dowLabel} 레슨 슬롯`
  const feeText = slot.fee_amount != null ? `${slot.fee_amount.toLocaleString()}원` : '별도 협의'
  const today = new Date().toISOString().substring(0, 10)
  // 첫 번째 아직 지나지 않은 세션 날짜
  const nextSession = sessions.find((s) => s.slot_date >= today)

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* 제목 + 뱃지 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.4' }}>
          {title}
        </p>
        <span
          className="shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'var(--color-success-subtle, rgba(34,197,94,0.12))', color: 'var(--color-success)' }}
        >
          신청 가능
        </span>
      </div>

      {/* 요일별 시간 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {dowTimes.length > 0 ? dowTimes.map(({ dow, start, end }) => (
          <div
            key={dow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <span className="font-bold text-sm" style={{ color: 'var(--accent-color)' }}>{DAY_LABELS[dow]}</span>
            <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {start.slice(0, 5)}~{end.slice(0, 5)}
            </span>
          </div>
        )) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="text-sm tabular-nums">
              {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)}
            </span>
          </div>
        )}
      </div>

      {/* 메타 정보 */}
      <div className="flex items-center gap-4 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        {slot.total_sessions && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            총 {slot.total_sessions}회
          </span>
        )}
        {slot.duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            회당 {slot.duration_minutes}분
          </span>
        )}
        {nextSession && (
          <span>첫 수업 {formatDateShort(nextSession.slot_date)}</span>
        )}
      </div>

      {/* 세션 날짜 칩 */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {sessions.map((s) => (
            <span
              key={s.slot_date}
              className="text-sm px-2 py-0.5 rounded-full tabular-nums"
              style={{
                backgroundColor: s.slot_date >= today ? 'var(--bg-secondary)' : 'transparent',
                color: s.slot_date >= today ? 'var(--text-secondary)' : 'var(--text-muted)',
                border: `1px solid var(--border-color)`,
                opacity: s.slot_date < today ? 0.5 : 1,
              }}
            >
              {formatDateShort(s.slot_date)}
            </span>
          ))}
        </div>
      )}

      {/* 요금 + 예약 버튼 */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>수강료</p>
          <p className="font-bold text-lg tabular-nums" style={{ color: 'var(--text-primary)' }}>{feeText}</p>
        </div>
        <button
          onClick={() => onBook(slot)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
        >
          예약 신청
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── BookingModal ─────────────────────────────────────────────────────────────

interface BookingModalProps {
  slot: LessonSlot | null
  coachName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function BookingModal({ slot, coachName, isOpen, onClose, onSuccess }: BookingModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [isMember, setIsMember] = useState(false)  // 로그인 회원 여부
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  // 모달 열릴 때: 회원 프로필 조회 → 자동 채움
  useEffect(() => {
    if (!isOpen) return
    setNote('')
    getCurrentMemberProfile().then((profile) => {
      if (profile) {
        setName(profile.name)
        setPhone(profile.phone)
        setIsMember(true)
      } else {
        setName('')
        setPhone('')
        setIsMember(false)
      }
    })
  }, [isOpen])

  if (!slot) return null

  const sessions = slot.sessions ?? []
  const dowTimes = getPerDowTimes(sessions)
  const dowLabel = getPackageDowLabel(sessions, slot.slot_date)
  const title = slot.frequency ? `${dowLabel} 주${slot.frequency}회 레슨 패키지` : `${dowLabel} 레슨 슬롯`
  const feeText = slot.fee_amount != null ? `${slot.fee_amount.toLocaleString()}원` : '별도 협의'

  const handleSubmit = async () => {
    const trimName = name.trim()
    const trimPhone = phone.trim()
    if (!trimName) { setAlert({ isOpen: true, message: '이름을 입력해주세요.' }); return }
    if (!trimPhone) { setAlert({ isOpen: true, message: '연락처를 입력해주세요.' }); return }
    if (!isMember && !/^0\d{8,10}$/.test(trimPhone.replace(/-/g, ''))) {
      setAlert({ isOpen: true, message: '올바른 전화번호를 입력해주세요. (예: 01012345678)' })
      return
    }
    setSubmitting(true)
    const result = await createBooking({
      slot_ids: [slot.id],
      // 비회원일 때만 guest 정보 전달 (회원이면 createBooking 내부에서 자동 감지)
      ...(!isMember && { guest_name: trimName, guest_phone: trimPhone }),
      note: note.trim() || undefined,
    })
    setSubmitting(false)
    if (result.error) { setAlert({ isOpen: true, message: result.error }); return }
    onSuccess()
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-input, var(--bg-secondary))',
    border: '1.5px solid var(--border-color)',
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="레슨 예약 신청" size="sm">
        <Modal.Body>
          {/* 패키지 요약 */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>코치: {coachName}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {dowTimes.map(({ dow, start, end }) => (
                <span key={dow} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{DAY_LABELS[dow]}</span>{' '}
                  {start.slice(0, 5)}~{end.slice(0, 5)}
                </span>
              ))}
            </div>
            {slot.total_sessions && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                총 {slot.total_sessions}회 · {slot.duration_minutes}분 · {feeText}
              </p>
            )}
          </div>

          {/* 신청자 정보 */}
          <div className="space-y-4">
            {/* 회원 자동 채움 안내 */}
            {isMember && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--color-success-subtle, rgba(34,197,94,0.1))', color: 'var(--color-success)' }}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                회원 정보로 자동 입력되었습니다
              </div>
            )}

            {/* 이름 */}
            <div>
              <label htmlFor="booking-name" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="booking-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  readOnly={isMember}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: isMember ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <label htmlFor="booking-phone" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                연락처 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="booking-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  readOnly={isMember}
                  className="flex-1 bg-transparent text-sm outline-none tabular-nums"
                  style={{ color: isMember ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label htmlFor="booking-note" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                메모 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
              </label>
              <div className="flex gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                <textarea
                  id="booking-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="원하는 레슨 목표, 현재 실력, 기타 문의사항을 입력해주세요"
                  rows={3}
                  maxLength={300}
                  className="flex-1 bg-transparent text-sm outline-none resize-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              예약 신청 후 관리자 확인을 거쳐 확정됩니다. 확정 여부는 연락처로 안내드립니다.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-color)', color: '#fff', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '신청하기'}
          </button>
        </Modal.Footer>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="입력 오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface LessonsPageClientProps {
  coaches: Coach[]
}

export function LessonsPageClient({ coaches }: LessonsPageClientProps) {
  const [selectedCoachId, setSelectedCoachId] = useState(coaches[0]?.id ?? '')
  const [slots, setSlots] = useState<LessonSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingSlot, setBookingSlot] = useState<LessonSlot | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId)

  const loadSlots = useCallback(async (coachId: string) => {
    if (!coachId) return
    setLoadingSlots(true)
    const { data } = await getPublicOpenSlots(coachId)
    setSlots(data)
    setLoadingSlots(false)
  }, [])

  useEffect(() => {
    if (selectedCoachId) loadSlots(selectedCoachId)
  }, [selectedCoachId, loadSlots])

  const handleBook = (slot: LessonSlot) => {
    setBookingSlot(slot)
    setBookingSuccess(false)
  }

  const handleBookingSuccess = () => {
    setBookingSlot(null)
    setBookingSuccess(true)
    setToast({ isOpen: true, message: '예약 신청이 완료되었습니다! 확정 후 연락드립니다.', type: 'success' })
    loadSlots(selectedCoachId)
  }

  if (coaches.length === 0) {
    return (
      <div className="text-center py-24">
        <GraduationCap className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          현재 등록된 코치가 없습니다
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          레슨 문의는 협회에 직접 연락해주세요.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 코치 탭 */}
      <div
        className="flex gap-1 border-b mb-8"
        style={{ borderColor: 'var(--border-color)' }}
        role="tablist"
        aria-label="코치 선택"
      >
        {coaches.map((coach) => {
          const isActive = selectedCoachId === coach.id
          return (
            <button
              key={coach.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCoachId(coach.id)}
              className="px-5 py-3 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                marginBottom: '-1px',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {coach.name}
            </button>
          )
        })}
      </div>

      {selectedCoach && (
        <div>
          {/* 코치 소개 */}
          {selectedCoach.bio && (
            <div
              className="flex gap-4 p-5 rounded-2xl mb-8"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              {/* 프로필 이미지 */}
              {selectedCoach.profile_image_url ? (
                <img
                  src={selectedCoach.profile_image_url}
                  alt={`${selectedCoach.name} 코치`}
                  className="w-16 h-16 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-xl font-bold"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                >
                  {selectedCoach.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
                  {selectedCoach.name} 코치
                </p>
                {selectedCoach.experience && (
                  <p className="text-sm mb-1" style={{ color: 'var(--accent-color)' }}>
                    {selectedCoach.experience}
                  </p>
                )}
                <p className="text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {selectedCoach.bio}
                </p>
                {selectedCoach.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedCoach.certifications.map((cert, i) => (
                      <span
                        key={i}
                        className="text-sm px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                )}
                {selectedCoach.lesson_location && (
                  <p className="flex items-center gap-1.5 mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {selectedCoach.lesson_location}
                  </p>
                )}
                {selectedCoach.phone && (
                  <a
                    href={`tel:${selectedCoach.phone}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium"
                    style={{ color: 'var(--accent-color)' }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {selectedCoach.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 슬롯 목록 */}
          <div>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              신청 가능한 레슨
            </h2>

            {loadingSlots ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-48 rounded-2xl animate-pulse"
                    style={{ backgroundColor: 'var(--bg-card)' }}
                  />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  현재 신청 가능한 레슨이 없습니다
                </p>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  희망 일정을 남기시면 슬롯 오픈 시 우선 안내드립니다.
                </p>
                <button
                  onClick={() => setInquiryOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <MessageSquare className="w-4 h-4" />
                  레슨 신청하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {slots.map((slot) => (
                  <PublicSlotCard key={slot.id} slot={slot} onBook={handleBook} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 예약 모달 */}
      <BookingModal
        slot={bookingSlot}
        coachName={selectedCoach?.name ?? ''}
        isOpen={!!bookingSlot}
        onClose={() => setBookingSlot(null)}
        onSuccess={handleBookingSuccess}
      />

      {/* 레슨 신청 모달 (슬롯 없을 때) */}
      <InquiryModal
        coachId={selectedCoach?.id ?? ''}
        coachName={selectedCoach?.name ?? ''}
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        onSuccess={() => {
          setInquiryOpen(false)
          setToast({ isOpen: true, message: '신청이 접수되었습니다! 곧 연락드리겠습니다.', type: 'success' })
        }}
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
        duration={5000}
      />
    </div>
  )
}

// ─── InquiryModal ─────────────────────────────────────────────────────────────

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
const TIME_OPTIONS = [
  '06:30~08:00', '08:00~10:00', '10:00~12:00',
  '12:00~14:00', '14:00~16:00', '16:00~18:00', '18:00~20:00',
]

interface InquiryModalProps {
  coachId: string
  coachName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function InquiryModal({ coachId, coachName, isOpen, onClose, onSuccess }: InquiryModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [preferredTime, setPreferredTime] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '' })
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setSelectedDays([])
    setPreferredTime('')
    setMessage('')
    getCurrentMemberProfile().then((profile) => {
      if (profile) {
        setName(profile.name)
        setPhone(profile.phone)
        setIsMember(true)
      } else {
        setName('')
        setPhone('')
        setIsMember(false)
      }
    })
  }, [isOpen])

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async () => {
    const trimName = name.trim()
    const trimPhone = phone.trim()
    if (!trimName) { setAlert({ isOpen: true, message: '이름을 입력해주세요.' }); return }
    if (!trimPhone) { setAlert({ isOpen: true, message: '연락처를 입력해주세요.' }); return }
    if (selectedDays.length === 0) { setAlert({ isOpen: true, message: '희망 요일을 선택해주세요.' }); return }
    if (!preferredTime) { setAlert({ isOpen: true, message: '희망 시간대를 선택해주세요.' }); return }

    setSubmitting(true)
    const result = await createLessonInquiry({
      coachId,
      name: trimName,
      phone: trimPhone,
      preferredDays: selectedDays,
      preferredTime,
      message,
    })
    setSubmitting(false)

    if (result.error) { setAlert({ isOpen: true, message: result.error }); return }
    onSuccess()
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-input, var(--bg-secondary))',
    border: '1.5px solid var(--border-color)',
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="레슨 신청" size="sm">
        <Modal.Body>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{coachName} 코치</span>에게 레슨을 신청합니다.
            희망 일정을 남기시면 슬롯 오픈 시 우선 안내드립니다.
          </p>

          <div className="space-y-4">
            {isMember && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--color-success-subtle, rgba(34,197,94,0.1))', color: 'var(--color-success)' }}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                회원 정보로 자동 입력되었습니다
              </div>
            )}

            {/* 이름 */}
            <div>
              <label htmlFor="inq-name" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="inq-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  readOnly={isMember}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: isMember ? 'var(--text-muted)' : 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <label htmlFor="inq-phone" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                연락처 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="inq-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  readOnly={isMember}
                  className="flex-1 bg-transparent text-sm outline-none tabular-nums"
                  style={{ color: isMember ? 'var(--text-muted)' : 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* 희망 요일 */}
            <div>
              <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                희망 요일 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((day) => {
                  const active = selectedDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className="w-9 h-9 rounded-lg text-sm font-medium transition-colors"
                      style={
                        active
                          ? { backgroundColor: 'var(--accent-color)', color: '#fff' }
                          : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
                      }
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 희망 시간대 */}
            <div>
              <label htmlFor="inq-time" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                희망 시간대 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                id="inq-time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm appearance-none"
                style={{ ...inputStyle, color: preferredTime ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                <option value="">시간대 선택</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* 메모 */}
            <div>
              <label htmlFor="inq-message" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                기타 문의 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
              </label>
              <div className="flex gap-2 px-3 py-2.5 rounded-xl" style={inputStyle}>
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                <textarea
                  id="inq-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="현재 실력, 레슨 목표 등을 알려주세요"
                  rows={2}
                  maxLength={200}
                  className="flex-1 bg-transparent text-sm outline-none resize-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-color)', color: '#fff', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '신청하기'}
          </button>
        </Modal.Footer>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="입력 오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}
