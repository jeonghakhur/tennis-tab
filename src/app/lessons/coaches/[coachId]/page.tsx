'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, User, Award, Clock, Calendar, ArrowRight } from 'lucide-react'
import { getPublicCoachDetail, type PublicCoachDetail } from '@/lib/coaches/actions'

/** 요금 표시: null이면 "문의" */
function feeText(amount: number | null): string {
  if (amount == null || amount <= 0) return '문의'
  return `${amount.toLocaleString()}원`
}

/** 날짜를 "3/17 (월)" 형태로 포맷 */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`
}

/** 요금표 테이블 */
function FeeTable({ program }: { program: PublicCoachDetail['program'] }) {
  if (!program) return null

  const rows = [
    {
      label: '주중',
      fee1: program.feeWeekday1,
      fee2: program.feeWeekday2,
    },
    {
      label: '주말',
      fee1: program.feeWeekend1,
      fee2: program.feeWeekend2,
    },
    {
      label: '혼합',
      fee1: null,
      fee2: program.feeMixed2,
    },
  ]

  // 모든 요금이 null이면 렌더 안 함
  const hasAnyFee = rows.some((r) => r.fee1 != null || r.fee2 != null)
  if (!hasAnyFee) return null

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-card-hover)' }}>
            <th
              className="px-4 py-2.5 text-left font-medium"
              style={{ color: 'var(--text-secondary)' }}
              scope="col"
            >
              구분
            </th>
            <th
              className="px-4 py-2.5 text-right font-medium"
              style={{ color: 'var(--text-secondary)' }}
              scope="col"
            >
              주 1회
            </th>
            <th
              className="px-4 py-2.5 text-right font-medium"
              style={{ color: 'var(--text-secondary)' }}
              scope="col"
            >
              주 2회
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderTop: '1px solid var(--border-color)' }}>
              <td
                className="px-4 py-2.5 font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {row.label}
              </td>
              <td
                className="px-4 py-2.5 text-right"
                style={{ color: row.fee1 != null ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {row.label === '혼합' ? '-' : feeText(row.fee1)}
              </td>
              <td
                className="px-4 py-2.5 text-right"
                style={{ color: row.fee2 != null ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {feeText(row.fee2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CoachDetailPage() {
  const { coachId } = useParams<{ coachId: string }>()
  const router = useRouter()
  const [coach, setCoach] = useState<PublicCoachDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPublicCoachDetail(coachId).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err || '코치를 찾을 수 없습니다.')
      } else {
        setCoach(data)
      }
      setLoading(false)
    })
  }, [coachId])

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-24 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            <div className="h-20 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            <div className="h-40 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error || !coach) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div className="max-w-content mx-auto px-6 py-12 text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {error || '코치를 찾을 수 없습니다.'}
          </p>
          <Link
            href="/lessons"
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={{ color: 'var(--accent-color)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            레슨 안내로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-content mx-auto px-6 py-8">
        {/* 뒤로가기 */}
        <Link
          href="/lessons"
          className="inline-flex items-center gap-1 text-sm mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          레슨 안내
        </Link>

        {/* 코치 프로필 헤더 */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              {coach.profileImageUrl ? (
                <img
                  src={coach.profileImageUrl}
                  alt={`${coach.name} 코치 프로필`}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <User className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {coach.name} 코치
              </h1>
              {coach.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {coach.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                    >
                      <Award className="w-3 h-3" />
                      {cert}
                    </span>
                  ))}
                </div>
              )}
              {coach.program && (
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {coach.program.sessionDurationMinutes}분 레슨
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 소개 */}
        {coach.bio && (
          <section
            className="rounded-xl p-5 mb-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              소개
            </h2>
            <p
              className="text-sm whitespace-pre-line leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {coach.bio}
            </p>
          </section>
        )}

        {/* 경력 */}
        {coach.experience && (
          <section
            className="rounded-xl p-5 mb-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              경력
            </h2>
            <p
              className="text-sm whitespace-pre-line leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {coach.experience}
            </p>
          </section>
        )}

        {/* 레슨 요금표 */}
        {coach.program && (
          <section
            className="rounded-xl p-5 mb-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              레슨 요금표
            </h2>
            <FeeTable program={coach.program} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              * 월 수강료 기준 (VAT 포함)
            </p>
          </section>
        )}

        {/* 빈 슬롯 미리보기 */}
        {coach.availableDates.length > 0 && (
          <section
            className="rounded-xl p-5 mb-6"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              <Calendar className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              이번 주 가능한 날짜
            </h2>
            <div className="flex flex-wrap gap-2">
              {coach.availableDates.map((dateStr) => (
                <span
                  key={dateStr}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: 'var(--color-success-subtle)',
                    color: 'var(--color-success)',
                  }}
                >
                  {formatShortDate(dateStr)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 레슨 신청 버튼 */}
        {coach.program && (
          <button
            type="button"
            onClick={() => router.push(`/lessons/${coach.program!.id}`)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              // @ts-expect-error CSS variable
              '--tw-ring-color': 'var(--accent-color)',
            }}
          >
            레슨 신청하기
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {!coach.program && (
          <div
            className="text-center py-6 rounded-xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              현재 모집 중인 레슨 프로그램이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
