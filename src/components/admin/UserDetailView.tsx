'use client'

import { formatKoreanDate } from '@/lib/utils/formatDate'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/roles'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import {
  User, Building2, GraduationCap, Calendar, Trophy,
  Phone, Mail, Clock, Shield,
} from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'
import type { ClubMemberRole, ClubMemberStatus } from '@/lib/clubs/types'

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole | null
  avatar_url: string | null
  club: string | null
  club_city: string | null
  club_district: string | null
  gender: string | null
  birth_year: string | null
  start_year: string | null
  rating: number | null
  created_at: string
}

export interface ClubMembership {
  id: string
  role: ClubMemberRole
  status: ClubMemberStatus
  joined_at: string | null
  created_at: string
  clubs: { id: string; name: string } | null
}

export interface Enrollment {
  id: string
  status: string
  enrolled_at: string
  program: {
    id: string
    title: string
    coach: { name: string } | null
  } | null
}

export interface Booking {
  id: string
  booking_type: string
  status: string
  fee_amount: number | null
  created_at: string
  confirmed_at: string | null
  cancelled_at: string | null
}

export interface TournamentEntry {
  id: string
  status: string
  payment_status: string
  player_name: string
  created_at: string
  division: {
    name: string
    tournament: { id: string; title: string; start_date: string; location: string } | null
  } | null
}

interface UserDetailViewProps {
  profile: Profile
  clubMemberships: ClubMembership[]
  enrollments: Enrollment[]
  bookings: Booking[]
  tournamentEntries: TournamentEntry[]
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CLUB_ROLE_LABEL: Record<string, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  VICE_PRESIDENT: '부회장',
  ADVISOR: '고문',
  MATCH_DIRECTOR: '경기이사',
  MEMBER: '회원',
}

const CLUB_STATUS_CONFIG: Record<ClubMemberStatus, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: '활동', variant: 'success' },
  PENDING: { label: '대기', variant: 'warning' },
  INVITED: { label: '초대', variant: 'info' },
  LEFT: { label: '탈퇴', variant: 'secondary' },
  REMOVED: { label: '제명', variant: 'danger' },
}

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  CONFIRMED: { label: '확정', variant: 'success' },
  PENDING: { label: '대기', variant: 'warning' },
  WAITLISTED: { label: '대기자', variant: 'info' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const BOOKING_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  CONFIRMED: { label: '확정', variant: 'success' },
  PENDING: { label: '대기', variant: 'warning' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const BOOKING_TYPE_LABEL: Record<string, string> = {
  WEEKDAY_1: '주중 1회',
  WEEKEND_1: '주말 1회',
  WEEKDAY_2: '주중 2회',
  WEEKEND_2: '주말 2회',
  MIXED_2: '혼합 2회',
}

const ENTRY_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기', variant: 'warning' },
  APPROVED: { label: '승인', variant: 'info' },
  CONFIRMED: { label: '확정', variant: 'success' },
  WAITLISTED: { label: '대기자', variant: 'purple' },
  REJECTED: { label: '거절', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '미결제', variant: 'warning' },
  COMPLETED: { label: '결제', variant: 'success' },
  FAILED: { label: '실패', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

// ─── 섹션 카드 ───────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, count, children }: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-(--border-color)">
        <Icon className="w-5 h-5 text-(--accent-color)" />
        <h2 className="font-display font-bold text-(--text-primary)">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-sm text-(--text-muted)">{count}건</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-(--text-muted) text-center py-4">{message}</p>
  )
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function UserDetailView({
  profile,
  clubMemberships,
  enrollments,
  bookings,
  tournamentEntries,
}: UserDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <SectionCard title="기본 정보" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={User} label="이름" value={profile.name} />
          <InfoRow icon={Mail} label="이메일" value={profile.email} />
          <InfoRow icon={Phone} label="전화번호" value={profile.phone ?? '-'} />
          <InfoRow icon={Shield} label="역할">
            <span className={ROLE_COLORS[profile.role ?? 'USER']}>
              {ROLE_LABELS[profile.role ?? 'USER']}
            </span>
          </InfoRow>
          <InfoRow icon={Calendar} label="가입일" value={formatKoreanDate(profile.created_at)} />
          {profile.gender && (
            <InfoRow icon={User} label="성별" value={profile.gender === 'MALE' ? '남' : '여'} />
          )}
          {profile.birth_year && (
            <InfoRow icon={Calendar} label="출생연도" value={profile.birth_year} />
          )}
          {profile.start_year && (
            <InfoRow icon={GraduationCap} label="테니스 시작" value={profile.start_year} />
          )}
          {profile.rating !== null && profile.rating !== undefined && (
            <InfoRow icon={Trophy} label="레이팅" value={String(profile.rating)} />
          )}
          {profile.club && (
            <InfoRow icon={Building2} label="클럽" value={
              [profile.club, profile.club_city, profile.club_district].filter(Boolean).join(' · ')
            } />
          )}
        </div>
      </SectionCard>

      {/* 클럽 가입 현황 */}
      <SectionCard title="클럽 가입 현황" icon={Building2} count={clubMemberships.length}>
        {clubMemberships.length === 0 ? (
          <EmptyState message="가입된 클럽이 없습니다." />
        ) : (
          <div className="space-y-3">
            {clubMemberships.map((cm) => (
              <div
                key={cm.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-(--bg-card-hover)"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-(--text-primary) truncate">
                    {cm.clubs?.name ?? '(알 수 없음)'}
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    {CLUB_ROLE_LABEL[cm.role] ?? cm.role}
                    {cm.joined_at ? ` · ${formatKoreanDate(cm.joined_at)} 가입` : ''}
                  </p>
                </div>
                <Badge variant={CLUB_STATUS_CONFIG[cm.status]?.variant ?? 'secondary'}>
                  {CLUB_STATUS_CONFIG[cm.status]?.label ?? cm.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 레슨 수강 현황 */}
      <SectionCard title="레슨 수강 현황" icon={GraduationCap} count={enrollments.length}>
        {enrollments.length === 0 ? (
          <EmptyState message="레슨 수강 이력이 없습니다." />
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <div
                key={e.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-(--bg-card-hover)"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-(--text-primary) truncate">
                    {e.program?.title ?? '(삭제된 프로그램)'}
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    {e.program?.coach?.name ? `${e.program.coach.name} 코치` : ''}
                    {e.enrolled_at ? ` · ${formatKoreanDate(e.enrolled_at)} 신청` : ''}
                  </p>
                </div>
                <Badge variant={ENROLLMENT_STATUS_CONFIG[e.status]?.variant ?? 'secondary'}>
                  {ENROLLMENT_STATUS_CONFIG[e.status]?.label ?? e.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 레슨 예약 현황 */}
      <SectionCard title="레슨 예약 현황 (슬롯)" icon={Clock} count={bookings.length}>
        {bookings.length === 0 ? (
          <EmptyState message="레슨 예약 이력이 없습니다." />
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-(--bg-card-hover)"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-(--text-primary)">
                    {BOOKING_TYPE_LABEL[b.booking_type] ?? b.booking_type}
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    {formatKoreanDate(b.created_at)} 예약
                    {b.fee_amount ? ` · ${b.fee_amount.toLocaleString()}원` : ''}
                  </p>
                </div>
                <Badge variant={BOOKING_STATUS_CONFIG[b.status]?.variant ?? 'secondary'}>
                  {BOOKING_STATUS_CONFIG[b.status]?.label ?? b.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 대회 참가 현황 */}
      <SectionCard title="대회 참가 현황" icon={Trophy} count={tournamentEntries.length}>
        {tournamentEntries.length === 0 ? (
          <EmptyState message="대회 참가 이력이 없습니다." />
        ) : (
          <div className="space-y-3">
            {tournamentEntries.map((te) => (
              <div
                key={te.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-(--bg-card-hover)"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-(--text-primary) truncate">
                    {te.division?.tournament?.title ?? '(삭제된 대회)'}
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    {te.division?.name ?? ''}
                    {te.division?.tournament?.start_date
                      ? ` · ${formatKoreanDate(te.division.tournament.start_date)}`
                      : ''}
                    {te.division?.tournament?.location
                      ? ` · ${te.division.tournament.location}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={ENTRY_STATUS_CONFIG[te.status]?.variant ?? 'secondary'}>
                    {ENTRY_STATUS_CONFIG[te.status]?.label ?? te.status}
                  </Badge>
                  <Badge variant={PAYMENT_STATUS_CONFIG[te.payment_status]?.variant ?? 'secondary'}>
                    {PAYMENT_STATUS_CONFIG[te.payment_status]?.label ?? te.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── 유틸 컴포넌트 ──────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, children }: {
  icon: React.ElementType
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-(--text-muted) shrink-0" />
      <div>
        <p className="text-xs text-(--text-muted)">{label}</p>
        {children ?? (
          <p className="text-sm text-(--text-primary) font-medium">{value}</p>
        )}
      </div>
    </div>
  )
}
