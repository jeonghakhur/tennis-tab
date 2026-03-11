'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getClubRankingsByPeriod,
  getMemberGameResults,
  getClubDefaultRankingPeriod,
  updateClubDefaultRankingPeriod,
  type RankingPeriod,
  type MemberGameResult,
} from '@/lib/clubs/session-actions'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import MemberResultsClient from '@/app/clubs/[id]/members/[memberId]/MemberResultsClient'
import YearMonthPicker, { type YearMonth } from './YearMonthPicker'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SIMPLE_PERIODS = ['all', 'custom'] as const
type SimplePeriod = typeof SIMPLE_PERIODS[number]

const SIMPLE_LABELS: Record<SimplePeriod, string> = {
  all: '전체',
  custom: '직접 설정',
}

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface SelectedMember {
  id: string
  name: string
  rating?: number | null
  initialResults: MemberGameResult[]
  initialStats: { total: number; wins: number; losses: number; win_rate: number }
}

interface RankingsTabProps {
  clubId: string
  myMemberId?: string
  isOfficer?: boolean
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** YearMonth → 날짜 범위 문자열 */
function toCustomRange(from: YearMonth, to: YearMonth) {
  return {
    from: `${from.year}-${String(from.month).padStart(2, '0')}-01`,
    to:   `${to.year}-${String(to.month).padStart(2, '0')}-31`,
  }
}

/** YYYY-MM-DD → YearMonth (없으면 현재 년월) */
function parseYm(date: string | null): YearMonth {
  if (!date) return { year: CURRENT_YEAR, month: NOW.getMonth() + 1 }
  const [y, m] = date.split('-')
  return { year: parseInt(y), month: parseInt(m) }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function RankingsTab({ clubId, myMemberId, isOfficer }: RankingsTabProps) {
  const [period, setPeriod] = useState<RankingPeriod>('all')
  const [customFrom, setCustomFrom] = useState<YearMonth>({ year: CURRENT_YEAR, month: 1 })
  const [customTo, setCustomTo] = useState<YearMonth>({ year: CURRENT_YEAR, month: NOW.getMonth() + 1 })
  const [rankings, setRankings] = useState<Awaited<ReturnType<typeof getClubRankingsByPeriod>>>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'win_points' | 'win_rate' | 'margin'>('win_points')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  // 모달
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null)
  const [memberLoading, setMemberLoading] = useState(false)

  // 관리자 기본값 저장
  const [savingDefault, setSavingDefault] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  // ── 순위 조회 ──────────────────────────────────────────────────────────────

  const fetchRankings = useCallback(async (
    targetPeriod: RankingPeriod,
    range?: { from: string; to: string }
  ) => {
    setLoading(true)
    const data = await getClubRankingsByPeriod(clubId, targetPeriod, range)
    setRankings(data)
    setLoading(false)
  }, [clubId])

  // 프리셋 기간 변경 시 자동 조회 (custom은 버튼 클릭 시만)
  useEffect(() => {
    if (period === 'custom') return
    fetchRankings(period)
  }, [period, fetchRankings])

  // 마운트 시 클럽 기본 기간 로드
  useEffect(() => {
    getClubDefaultRankingPeriod(clubId).then(({ period: p, customFrom: cf, customTo: ct }) => {
      setPeriod(p)
      if (p === 'custom' && cf && ct) {
        setCustomFrom(parseYm(cf))
        setCustomTo(parseYm(ct))
        // custom은 effect에서 자동 fetch가 안 되므로 직접 호출
        fetchRankings('custom', { from: cf, to: ct })
      }
      // 프리셋은 위 effect에서 처리됨
    })
    // fetchRankings 제외: 마운트 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  // ── 커스텀 기간 조회 ────────────────────────────────────────────────────────

  const handleCustomSearch = () => {
    fetchRankings('custom', toCustomRange(customFrom, customTo))
  }

  // ── 관리자 기본값 저장 ──────────────────────────────────────────────────────

  const handleSaveDefault = async () => {
    setSavingDefault(true)
    const range = period === 'custom' ? toCustomRange(customFrom, customTo) : undefined
    const result = await updateClubDefaultRankingPeriod(
      clubId, period, range?.from ?? null, range?.to ?? null
    )
    setSavingDefault(false)
    setToast({
      isOpen: true,
      message: result.error ? result.error : '기본 조회 기간이 저장되었습니다.',
      type: result.error ? 'success' : 'success', // Toast는 success만 지원 → 추후 개선 가능
    })
  }

  // ── 회원 상세 ──────────────────────────────────────────────────────────────

  const handleMemberClick = useCallback(async (
    memberId: string, name: string, rating?: number | null
  ) => {
    setMemberLoading(true)
    setSelectedMember({
      id: memberId, name, rating,
      initialResults: [],
      initialStats: { total: 0, wins: 0, losses: 0, win_rate: 0 },
    })
    const { results, stats } = await getMemberGameResults(clubId, memberId, 'all')
    setSelectedMember({ id: memberId, name, rating, initialResults: results, initialStats: stats })
    setMemberLoading(false)
  }, [clubId])

  // ── 정렬 ────────────────────────────────────────────────────────────────────

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedRankings = [...rankings].sort((a, b) => {
    const diff = b[sortKey] - a[sortKey]
    return sortDir === 'desc' ? diff : -diff
  })

  // ── 현재 기간 레이블 (커스텀 시 범위 표시) ─────────────────────────────────

  const currentLabel = period === 'custom'
    ? `${customFrom.year}.${String(customFrom.month).padStart(2, '0')} ~ ${customTo.year}.${String(customTo.month).padStart(2, '0')}`
    : '전체'

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4">
        {/* 기간 필터 */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-(--text-primary) pt-0.5">클럽 순위</h3>
            <div className="flex flex-col items-end gap-2">
              {/* 기간 버튼 */}
              <div className="flex gap-1">
                {SIMPLE_PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      (p === 'custom' ? period === 'custom' : period === p)
                        ? 'bg-(--accent-color) text-(--bg-primary)'
                        : 'bg-(--bg-secondary) text-(--text-muted) hover:text-(--text-primary)'
                    }`}
                  >
                    {SIMPLE_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* 관리자 기본값 저장 버튼 */}
              {isOfficer && (
                <button
                  onClick={handleSaveDefault}
                  disabled={savingDefault}
                  className="text-xs text-(--text-muted) hover:text-(--accent-color) transition-colors disabled:opacity-50 underline underline-offset-2"
                >
                  {savingDefault ? '저장 중...' : '현재 기간을 기본값으로 저장'}
                </button>
              )}
            </div>
          </div>

          {/* 커스텀 기간 선택기 */}
          {period === 'custom' && (
            <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
              <YearMonthPicker value={customFrom} onChange={setCustomFrom} label="시작" />
              <span className="text-(--text-muted) text-sm">~</span>
              <YearMonthPicker value={customTo} onChange={setCustomTo} label="종료" />
              <button
                onClick={handleCustomSearch}
                className="ml-auto px-4 py-1.5 text-xs rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold hover:opacity-90 transition-opacity"
              >
                조회
              </button>
            </div>
          )}
        </div>

        {/* 순위 목록 */}
        {loading ? (
          <div className="text-center py-12 text-(--text-muted) text-sm">불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-12 text-(--text-muted) text-sm">
            {currentLabel} 경기 기록이 없습니다.
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-(--text-muted) border-b border-(--border-color)">
              <span className="w-7 text-center shrink-0">#</span>
              <span className="flex-1">이름</span>
              <span className="hidden md:block w-14 text-center">경기</span>
              <span className="hidden md:block w-10 text-center">승</span>
              <span className="hidden md:block w-10 text-center">패</span>
              <span className="hidden md:block w-12 text-center">득점</span>
              <span className="hidden md:block w-12 text-center">실점</span>
              <SortHeader label="마진" sortKey="margin" current={sortKey} dir={sortDir} onSort={handleSort}
                className="hidden md:flex w-14 justify-center" />
              <SortHeader label="승률" sortKey="win_rate" current={sortKey} dir={sortDir} onSort={handleSort}
                className="w-12 justify-end" />
              <SortHeader label="승점" sortKey="win_points" current={sortKey} dir={sortDir} onSort={handleSort}
                className="w-12 justify-end" />
            </div>

            {sortedRankings.map((stat, index) => {
              const isMe = stat.member.id === myMemberId
              const rank = index + 1
              const marginSign = stat.margin > 0 ? '+' : ''
              const marginColor = stat.margin > 0
                ? 'text-(--color-success)'
                : stat.margin < 0 ? 'text-(--color-danger)' : 'text-(--text-muted)'

              return (
                <button
                  key={stat.member.id}
                  onClick={() => handleMemberClick(stat.member.id, stat.member.name, stat.member.rating)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-(--border-color) last:border-0 hover:bg-(--bg-card-hover) transition-colors text-left ${
                    isMe ? 'bg-(--color-success-subtle)' : ''
                  }`}
                >
                  {/* 순위 */}
                  <span className={`w-7 text-center font-bold text-base shrink-0 ${rank <= 3 ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                    {rank}
                  </span>

                  {/* 이름 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-(--text-primary) truncate">
                      {stat.member.name}
                      {isMe && <span className="text-sm text-(--text-muted) ml-1">(나)</span>}
                      {stat.member.rating && (
                        <span className="text-sm text-(--text-muted) ml-1">{stat.member.rating}</span>
                      )}
                    </div>
                    {/* 모바일 전용 서브 통계 */}
                    <div className="flex md:hidden items-center gap-2 mt-0.5 text-sm text-(--text-muted)">
                      <span>{stat.total}경기</span>
                      <span className="text-(--color-success)">{stat.wins}승</span>
                      <span className="text-(--color-danger)">{stat.losses}패</span>
                      <span className="text-(--border-color)">·</span>
                      <span>득{stat.points_for} 실{stat.points_against}</span>
                      <span className={`font-medium ${marginColor}`}>{marginSign}{stat.margin}</span>
                    </div>
                  </div>

                  {/* 데스크탑 전용 개별 컬럼 */}
                  <span className="hidden md:block w-14 text-center text-base text-(--text-secondary)">{stat.total}</span>
                  <span className="hidden md:block w-10 text-center text-base text-(--color-success) font-medium">{stat.wins}</span>
                  <span className="hidden md:block w-10 text-center text-base text-(--color-danger) font-medium">{stat.losses}</span>
                  <span className="hidden md:block w-12 text-center text-base text-(--text-secondary)">{stat.points_for}</span>
                  <span className="hidden md:block w-12 text-center text-base text-(--text-secondary)">{stat.points_against}</span>
                  <span className={`hidden md:block w-14 text-center text-base font-semibold ${marginColor}`}>{marginSign}{stat.margin}</span>

                  {/* 승률 (항상 표시) */}
                  <span className="w-12 text-right text-base font-semibold text-(--text-primary)">
                    {stat.win_rate}%
                  </span>

                  {/* 승점 (항상 표시) */}
                  <span className="w-12 text-right text-base font-semibold text-(--accent-color)">
                    {stat.win_points}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 회원 상세 모달 */}
      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={selectedMember?.name ?? ''}
        size="lg"
      >
        <Modal.Body>
          {memberLoading ? (
            <div className="space-y-3 animate-pulse py-2">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                ))}
              </div>
              <div className="h-32 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-48 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          ) : selectedMember ? (
            <MemberResultsClient
              clubId={clubId}
              memberId={selectedMember.id}
              initialResults={selectedMember.initialResults}
              initialStats={selectedMember.initialStats}
            />
          ) : null}
        </Modal.Body>
      </Modal>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}

// ─── 정렬 헤더 버튼 ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = '',
}: {
  label: string
  sortKey: 'win_points' | 'win_rate' | 'margin'
  current: 'win_points' | 'win_rate' | 'margin'
  dir: 'desc' | 'asc'
  onSort: (key: 'win_points' | 'win_rate' | 'margin') => void
  className?: string
}) {
  const isActive = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-0.5 text-xs font-semibold transition-colors ${
        isActive ? 'text-(--accent-color)' : 'text-(--text-muted) hover:text-(--text-primary)'
      } ${className}`}
    >
      {label}
      <span className="text-[10px] leading-none">
        {isActive ? (dir === 'desc' ? '▼' : '▲') : '↕'}
      </span>
    </button>
  )
}
