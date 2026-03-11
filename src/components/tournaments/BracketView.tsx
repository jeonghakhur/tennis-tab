'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Trophy, Users, RefreshCw, Lock, ChevronRight, MapPin } from 'lucide-react'
import { getBracketData, submitPlayerScore } from '@/lib/bracket/actions'
import { useMatchesRealtime, type RealtimeMatchPayload } from '@/lib/realtime/useMatchesRealtime'
import { useBracketConfigRealtime } from '@/lib/realtime/useBracketConfigRealtime'
import { ScoreInputModal } from '@/components/tournaments/ScoreInputModal'
import { Toast } from '@/components/common/AlertDialog'
import type { BracketStatus, MatchPhase, MatchStatus, MatchType, SetDetail, TournamentStatus } from '@/lib/supabase/types'

interface Division {
  id: string
  name: string
  max_teams: number | null
}

/** 대회가 마감되어 점수 입력 불가한 상태 */
const CLOSED_TOURNAMENT_STATUSES: TournamentStatus[] = ['COMPLETED', 'CANCELLED']

interface BracketViewProps {
  tournamentId: string
  divisions: Division[]
  initialDivisionId?: string
  // 선수용 props (선택적 — 비로그인 시 undefined)
  currentUserEntryIds?: string[]
  matchType?: MatchType | null
  teamMatchCount?: number | null
  tournamentStatus: TournamentStatus
}

interface BracketConfig {
  id: string
  has_preliminaries: boolean
  third_place_match: boolean
  bracket_size: number | null
  status: BracketStatus
  active_phase: string | null
  active_round: number | null
}

interface GroupTeam {
  id: string
  entry_id: string
  final_rank: number | null
  wins: number
  losses: number
  points_for: number
  points_against: number
  entry?: {
    id: string
    player_name: string
    club_name: string | null
    partner_data?: { name: string; rating: number; club: string | null } | null
  }
}

interface PreliminaryGroup {
  id: string
  name: string
  display_order: number
  group_teams?: GroupTeam[]
}

interface BracketMatch {
  id: string
  phase: MatchPhase
  group_id: string | null
  bracket_position: number | null
  round_number: number | null
  match_number: number
  team1_entry_id: string | null
  team2_entry_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_entry_id: string | null
  status: MatchStatus
  sets_detail: SetDetail[] | null
  court_location: string | null
  court_number: string | null
  team1?: { id: string; player_name: string; club_name: string | null; partner_data?: { name: string; rating: number; club: string | null } | null; team_members?: { name: string; rating: number }[] | null }
  team2?: { id: string; player_name: string; club_name: string | null; partner_data?: { name: string; rating: number; club: string | null } | null; team_members?: { name: string; rating: number }[] | null }
}

const phaseLabels: Record<MatchPhase, string> = {
  PRELIMINARY: '예선',
  ROUND_128: '128강',
  ROUND_64: '64강',
  ROUND_32: '32강',
  ROUND_16: '16강',
  QUARTER: '8강',
  SEMI: '4강',
  FINAL: '결승',
  THIRD_PLACE: '3/4위전',
}

export function BracketView({ tournamentId, divisions, initialDivisionId, currentUserEntryIds, matchType, teamMatchCount, tournamentStatus }: BracketViewProps) {
  const isClosed = CLOSED_TOURNAMENT_STATUSES.includes(tournamentStatus)
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(() => {
    if (divisions.length === 0) return null
    return divisions.find((d) => d.id === initialDivisionId) ?? divisions[0]
  })
  const [config, setConfig] = useState<BracketConfig | null>(null)
  const [groups, setGroups] = useState<PreliminaryGroup[] | null>(null)
  const [matches, setMatches] = useState<BracketMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'preliminary' | 'main'>('main')

  // 점수 입력 모달 상태
  const [scoreModalMatch, setScoreModalMatch] = useState<BracketMatch | null>(null)
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({ isOpen: false, message: '', type: 'success' })

  useEffect(() => {
    if (selectedDivision) {
      loadBracketData()
    }
  }, [selectedDivision])

  const loadBracketData = async () => {
    if (!selectedDivision) return
    setLoading(true)

    try {
      // 10초 타임아웃: Server Action hang 시 무한 스피너 방지
      const data = await Promise.race([
        getBracketData(selectedDivision.id),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000)
        ),
      ])
      setConfig(data.config)
      setGroups(data.groups)
      setMatches(data.matches)

      // 예선이 있으면 예선 탭, 없으면 본선 탭
      if (data.config?.has_preliminaries && data.config.status === 'PRELIMINARY') {
        setActiveTab('preliminary')
      } else {
        setActiveTab('main')
      }
    } catch {
      // 데이터 로딩 실패 또는 타임아웃 — 빈 상태 유지
    } finally {
      setLoading(false)
    }
  }

  // Realtime 이벤트용: 로딩 스피너 없이 전체 데이터 조용히 refetch
  // request counter로 stale 응답 무시 (race condition 방지)
  const requestCounterRef = useRef(0)

  const reloadSilently = useCallback(async () => {
    if (!selectedDivision) return
    const requestId = ++requestCounterRef.current
    try {
      const data = await getBracketData(selectedDivision.id)
      // 이 요청 이후 새 요청이 발생했으면 stale 응답이므로 무시
      if (requestId !== requestCounterRef.current) return
      setConfig(data.config)
      setGroups(data.groups)
      setMatches(data.matches)
    } catch {
      // silent — Realtime 보조 refetch이므로 에러 무시
    }
  }, [selectedDivision])

  // ref로 최신 함수 참조 유지 (stale closure 방지)
  const reloadSilentlyRef = useRef(reloadSilently)
  reloadSilentlyRef.current = reloadSilently

  // 디바운스된 reload 스케줄러 — 여러 entry_id 변경을 500ms 내 하나로 묶음
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => {
      reloadSilentlyRef.current()
      reloadTimerRef.current = null
    }, 500)
  }, [])

  // 현재 matches를 ref로 유지 (handleMatchUpdate에서 entry_id 비교용)
  // React 18 batching에서 setMatches 함수형 업데이터는 비동기 실행될 수 있으므로
  // ref로 동기적 비교 필요
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  // Realtime 구독 — 다른 선수의 점수 입력도 실시간 반영
  const handleMatchUpdate = useCallback((payload: RealtimeMatchPayload) => {
    // entry_id 변경 감지를 ref로 동기적 비교 (setMatches 내부가 아닌 외부에서)
    const target = matchesRef.current?.find((m) => m.id === payload.id)
    const needsRefetch = !!(
      target &&
      (target.team1_entry_id !== payload.team1_entry_id ||
        target.team2_entry_id !== payload.team2_entry_id)
    )

    setMatches((prev) => {
      if (!prev) return null
      return prev.map((m) => {
        if (m.id !== payload.id) return m
        return {
          ...m,
          team1_entry_id: payload.team1_entry_id,
          team2_entry_id: payload.team2_entry_id,
          team1_score: payload.team1_score,
          team2_score: payload.team2_score,
          winner_entry_id: payload.winner_entry_id,
          status: payload.status as BracketMatch['status'],
          court_location: payload.court_location,
          court_number: payload.court_number,
          sets_detail: payload.sets_detail as BracketMatch['sets_detail'],
        }
      })
    })

    // entry_id 변경 시 디바운스된 refetch로 JOIN 데이터 갱신
    if (needsRefetch) {
      scheduleReload()
    }
  }, [scheduleReload])

  useMatchesRealtime({
    bracketConfigId: config?.id || "",
    onMatchUpdate: handleMatchUpdate,
    onReload: scheduleReload,
    enabled: !!config?.id,
  })

  // bracket_config active_phase/active_round 변경 → 실시간 반영
  const configIds = useMemo(() => (config?.id ? [config.id] : []), [config?.id])
  useBracketConfigRealtime({
    configIds,
    onConfigChange: (_configId, activePhase, activeRound) => {
      setConfig((c) => c ? { ...c, active_phase: activePhase, active_round: activeRound } : c)
    },
    enabled: !isClosed && !!config?.id,
  })

  // 경기별 점수 입력 활성화 여부 — 관리자가 설정한 active_phase/active_round 기준
  const isMatchInProgress = useCallback((match: BracketMatch): boolean => {
    const activePhase = config?.active_phase
    if (!activePhase) return false
    if (activePhase === 'PRELIMINARY') return match.phase === 'PRELIMINARY'
    if (activePhase === 'MAIN') {
      const isMainPhase = match.phase !== 'PRELIMINARY'
      return isMainPhase && (config.active_round === null || match.round_number === config.active_round)
    }
    return false
  }, [config])

  // 선수 점수 입력 처리
  const handleScoreSubmit = async (team1Score: number, team2Score: number, setsDetail?: SetDetail[]) => {
    if (!scoreModalMatch) return

    const result = await submitPlayerScore(scoreModalMatch.id, team1Score, team2Score, setsDetail)

    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as const })
      return
    }

    setToast({ isOpen: true, message: '점수가 저장되었습니다.', type: 'success' as const })
    setScoreModalMatch(null)
    // 승자 전파로 다음 라운드 매치에 팀이 배정되므로 JOIN 데이터 갱신
    reloadSilentlyRef.current()
  }

  if (divisions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">참가 부서가 없습니다.</p>
      </div>
    )
  }

  const preliminaryMatches = matches?.filter((m) => m.phase === 'PRELIMINARY') || []
  const mainMatches = matches?.filter((m) => m.phase !== 'PRELIMINARY') || []

  return (
    <div className="space-y-6">
      {/* Division Tabs */}
      <div className="flex overflow-x-auto scrollbar-none border-b border-(--border-color)" style={{ WebkitOverflowScrolling: "touch" }}>
        {divisions.map((division) => {
          const isSelected = selectedDivision?.id === division.id
          return (
            <button
              key={division.id}
              onClick={() => setSelectedDivision(division)}
              className="relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {division.name}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-(--accent-color)" />
        </div>
      ) : !config ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
          <p className="text-(--text-secondary)">
            이 부서의 대진표가 아직 생성되지 않았습니다.
          </p>
        </div>
      ) : (
        <>
          {/* Phase Tabs (if has preliminaries) */}
          {config.has_preliminaries && (
            <div className="flex overflow-x-auto scrollbar-none border-b border-(--border-color)" style={{ WebkitOverflowScrolling: "touch" }}>
              {[
                { key: 'preliminary', label: '예선', icon: <Users className="w-4 h-4" /> },
                { key: 'main', label: '본선', icon: <Trophy className="w-4 h-4" /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as 'preliminary' | 'main')}
                  className="relative shrink-0 flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          {activeTab === 'preliminary' && config.has_preliminaries ? (
            <PreliminaryView
              groups={groups || []}
              matches={preliminaryMatches}
              currentUserEntryIds={currentUserEntryIds}
              onScoreInput={isClosed ? undefined : setScoreModalMatch}
              isMatchInProgress={isMatchInProgress}
              matchType={matchType}
            />
          ) : (
            <MainBracketView
              config={config}
              matches={mainMatches}
              currentUserEntryIds={currentUserEntryIds}
              onScoreInput={isClosed ? undefined : setScoreModalMatch}
              isMatchInProgress={isMatchInProgress}
              matchType={matchType}
            />
          )}
        </>
      )}

      {/* 점수 입력 모달 */}
      {scoreModalMatch && (
        <ScoreInputModal
          isOpen={!!scoreModalMatch}
          onClose={() => setScoreModalMatch(null)}
          match={scoreModalMatch}
          matchType={matchType ?? null}
          teamMatchCount={teamMatchCount ?? null}
          onSubmit={handleScoreSubmit}
        />
      )}

      {/* 토스트 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}

// ============================================================================
// 예선 조별리그 뷰
// ============================================================================
function PreliminaryView({
  groups,
  matches,
  currentUserEntryIds,
  onScoreInput,
  isMatchInProgress,
  matchType,
}: {
  groups: PreliminaryGroup[]
  matches: BracketMatch[]
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
  isMatchInProgress?: (match: BracketMatch) => boolean
  matchType?: MatchType | null
}) {
  // 내 조를 맨 위로 정렬 (early return 전에 위치해야 Rules of Hooks 위반 방지)
  const sortedGroups = useMemo(() => {
    if (!currentUserEntryIds || currentUserEntryIds.length === 0) return groups
    return [...groups].sort((a, b) => {
      const aHasMe = a.group_teams?.some((t) => currentUserEntryIds.includes(t.entry_id)) ?? false
      const bHasMe = b.group_teams?.some((t) => currentUserEntryIds.includes(t.entry_id)) ?? false
      if (aHasMe && !bHasMe) return -1
      if (!aHasMe && bHasMe) return 1
      return 0
    })
  }, [groups, currentUserEntryIds])

  if (groups.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Users className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">예선 조 편성이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {sortedGroups.map((group) => {
        // 내 경기를 맨 위로 정렬
        const groupMatches = matches.filter((m) => m.group_id === group.id)
          .sort((a, b) => {
            if (!currentUserEntryIds || currentUserEntryIds.length === 0) return 0
            const aIsMine = isMyEntry(a.team1_entry_id, currentUserEntryIds) || isMyEntry(a.team2_entry_id, currentUserEntryIds)
            const bIsMine = isMyEntry(b.team1_entry_id, currentUserEntryIds) || isMyEntry(b.team2_entry_id, currentUserEntryIds)
            if (aIsMine && !bIsMine) return -1
            if (!aIsMine && bIsMine) return 1
            return 0
          })
        const standings = group.group_teams
          ?.slice()
          .sort((a, b) => {
            if (a.final_rank && b.final_rank) return a.final_rank - b.final_rank
            return (b.wins - b.losses) - (a.wins - a.losses)
          })

        return (
          <div key={group.id} className="glass-card rounded-xl p-6">
            <h3 className="font-display text-lg font-semibold text-(--text-primary) mb-4">
              {group.name}조
            </h3>

            {/* Standings Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-(--text-muted) border-b border-(--border-color)">
                    <th className="text-left py-2 px-2">순위</th>
                    <th className="text-left py-2 px-2">팀</th>
                    <th className="text-center py-2 px-2">승</th>
                    <th className="text-center py-2 px-2">패</th>
                    <th className="text-center py-2 px-2">득/실</th>
                  </tr>
                </thead>
                <tbody>
                  {standings?.map((team, index) => {
                    const isMe = currentUserEntryIds?.includes(team.entry_id)
                    return (
                      <tr key={team.id} className={`border-b border-(--border-color) ${isMe ? 'bg-(--accent-color)/10' : ''}`}>
                        <td className="py-2 px-2">
                          <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                            index < 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-(--bg-secondary) text-(--text-muted)'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES' ? (
                            <p className={`font-medium ${isMe ? 'text-(--accent-color)' : 'text-(--text-primary)'}`}>
                              {team.entry?.club_name || team.entry?.player_name}{isMe ? ' (나)' : ''}
                            </p>
                          ) : (
                            <>
                              <p className={`font-medium ${isMe ? 'text-(--accent-color)' : 'text-(--text-primary)'}`}>
                                {team.entry?.player_name}{isMe ? ' (나)' : ''}
                              </p>
                              {team.entry?.partner_data && (
                                <p className={`text-xs ${isMe ? 'text-(--accent-color)/70' : 'text-(--text-muted)'}`}>
                                  {team.entry.partner_data.name}
                                </p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-emerald-400 font-medium">{team.wins}</td>
                        <td className="py-2 px-2 text-center text-rose-400 font-medium">{team.losses}</td>
                        <td className="py-2 px-2 text-center text-(--text-secondary)">
                          {team.points_for}/{team.points_against}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Match Results */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-(--text-muted) mb-2">경기 결과</h4>
              {groupMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserEntryIds={currentUserEntryIds}
                  onScoreInput={onScoreInput}
                  isMatchInProgress={isMatchInProgress}
                  matchType={matchType}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// 본선 대진표 뷰
// ============================================================================
function MainBracketView({
  config,
  matches,
  currentUserEntryIds,
  onScoreInput,
  isMatchInProgress,
  matchType,
}: {
  config: BracketConfig
  matches: BracketMatch[]
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
  isMatchInProgress?: (match: BracketMatch) => boolean
  matchType?: MatchType | null
}) {
  // 라운드별로 그룹화
  const matchesByPhase = useMemo(() => {
    return matches.reduce((acc, match) => {
      if (!acc[match.phase]) acc[match.phase] = []
      acc[match.phase].push(match)
      return acc
    }, {} as Record<MatchPhase, BracketMatch[]>)
  }, [matches])

  const phaseOrder: MatchPhase[] = [
    'ROUND_128', 'ROUND_64', 'ROUND_32', 'ROUND_16',
    'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'
  ]

  const activePhases = phaseOrder.filter((phase) => matchesByPhase[phase]?.length > 0)

  // 라운드별 상태 계산
  // 양쪽 팀이 모두 없는 빈 매치(bracket_size > 실제 참가자)는 카운트에서 제외
  const phaseStatus = useMemo(() => {
    const status: Record<string, { playable: boolean; completed: number; total: number; allDone: boolean }> = {}
    for (const phase of activePhases) {
      const phaseMatches = matchesByPhase[phase] || []
      const hasTeams = phaseMatches.some((m) => m.team1_entry_id || m.team2_entry_id)
      // 빈 매치(양팀 null)는 전체/완료 카운트에서 모두 제외
      const actualMatches = phaseMatches.filter((m) => m.team1_entry_id || m.team2_entry_id)
      const completed = actualMatches.filter((m) => m.status === 'COMPLETED' || m.status === 'BYE').length
      const total = actualMatches.length
      // allDone: 실제 경기가 모두 완료되었거나, 실제 경기가 없는 라운드(전부 빈 매치)도 완료로 간주
      status[phase] = { playable: hasTeams, completed, total, allDone: total === 0 || completed === total }
    }
    return status
  }, [activePhases, matchesByPhase])

  // 표시할 라운드: 완료된 라운드 + 현재 진행 중인 라운드(팀 배정된 첫 미완료 라운드)만 표시
  const visiblePhases = useMemo(() => {
    const visible: MatchPhase[] = []
    for (const phase of activePhases) {
      const s = phaseStatus[phase]
      if (s.allDone) {
        // 완료된 라운드 — 보여줌
        visible.push(phase)
      } else if (s.playable) {
        // 진행 가능한 미완료 라운드 — 보여주고 여기서 멈춤
        visible.push(phase)
        break
      } else {
        // 팀 미배정 라운드 — 멈춤
        break
      }
    }
    return visible
  }, [activePhases, phaseStatus])

  // 현재 활성 라운드 (마지막 visible)
  const currentPhase = visiblePhases.length > 0 ? visiblePhases[visiblePhases.length - 1] : null

  // 내 경기가 있는 라운드 찾기 (진행중 우선, 없으면 마지막 완료)
  const myPhase = useMemo(() => {
    if (!currentUserEntryIds || currentUserEntryIds.length === 0) return null
    const hasMyMatch = (phase: MatchPhase) =>
      matchesByPhase[phase]?.some(
        (m) => isMyEntry(m.team1_entry_id, currentUserEntryIds) || isMyEntry(m.team2_entry_id, currentUserEntryIds)
      )
    // 우선: 아직 진행 중인(미완료) 내 경기가 있는 라운드
    const activeMyPhase = visiblePhases.find(
      (phase) =>
        hasMyMatch(phase) &&
        matchesByPhase[phase]?.some(
          (m) =>
            m.status !== 'COMPLETED' && m.status !== 'BYE' &&
            (isMyEntry(m.team1_entry_id, currentUserEntryIds) || isMyEntry(m.team2_entry_id, currentUserEntryIds))
        )
    )
    if (activeMyPhase) return activeMyPhase
    // 차선: 내 경기가 있는 가장 마지막 라운드
    const allMyPhases = visiblePhases.filter((phase) => hasMyMatch(phase))
    return allMyPhases.length > 0 ? allMyPhases[allMyPhases.length - 1] : null
  }, [visiblePhases, matchesByPhase, currentUserEntryIds])

  // 선택된 라운드 (기본: 내 경기 라운드 > 현재 활성 라운드)
  const [selectedPhase, setSelectedPhase] = useState<MatchPhase | null>(myPhase || currentPhase)

  // 데이터 갱신 시 selectedPhase 보정
  useEffect(() => {
    if (!selectedPhase || !visiblePhases.includes(selectedPhase)) {
      setSelectedPhase(myPhase || currentPhase)
    }
  }, [visiblePhases, selectedPhase, myPhase, currentPhase])

  // 내 경기를 맨 위로 정렬 (early return 전에 위치해야 Rules of Hooks 위반 방지)
  const selectedMatches = useMemo(() => {
    const raw = selectedPhase ? (matchesByPhase[selectedPhase] || []) : []
    if (!currentUserEntryIds || currentUserEntryIds.length === 0) return raw
    return [...raw].sort((a, b) => {
      const aIsMine = isMyEntry(a.team1_entry_id, currentUserEntryIds) || isMyEntry(a.team2_entry_id, currentUserEntryIds)
      const bIsMine = isMyEntry(b.team1_entry_id, currentUserEntryIds) || isMyEntry(b.team2_entry_id, currentUserEntryIds)
      if (aIsMine && !bIsMine) return -1
      if (!aIsMine && bIsMine) return 1
      return 0
    })
  }, [selectedPhase, matchesByPhase, currentUserEntryIds])

  if (matches.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">본선 대진표가 아직 생성되지 않았습니다.</p>
      </div>
    )
  }

  // 다음 미개방 라운드 이름 (표시용)
  const nextLockedPhase = activePhases.find((phase) => !visiblePhases.includes(phase))

  return (
    <div className="space-y-6">
      {/* 라운드 탭 — 언더라인 스타일, 뎁스별 굵기 차등 */}
      <div
        className="flex overflow-x-auto scrollbar-none border-b border-(--border-color)"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {visiblePhases.map((phase, index) => {
          const s = phaseStatus[phase]
          const isSelected = selectedPhase === phase
          const isCurrent = phase === currentPhase && !s.allDone
          // 뎁스: 뒤 라운드일수록 index 높음 → 폰트 더 굵게
          const depthWeight = index < visiblePhases.length / 2 ? 400 : index < visiblePhases.length * 0.75 ? 500 : 600

          return (
            <button
              key={phase}
              onClick={() => setSelectedPhase(phase)}
              className="relative shrink-0 flex flex-col items-center px-4 py-2.5 transition-colors whitespace-nowrap"
              style={{
                fontWeight: isSelected ? 700 : depthWeight,
                fontSize: '13px',
                color: isSelected
                  ? 'var(--text-primary)'
                  : s.allDone
                  ? 'var(--text-secondary)'
                  : 'var(--text-muted)',
                borderBottom: isSelected
                  ? '2px solid var(--accent-color)'
                  : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <span className="flex items-center gap-1">
                {phaseLabels[phase]}
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-(--accent-color) animate-pulse" />
                )}
                {s.allDone && !isCurrent && (
                  <span className="text-[10px] opacity-60">✓</span>
                )}
              </span>
              <span
                className="text-[10px] mt-0.5"
                style={{ opacity: isSelected ? 0.6 : 0.45 }}
              >
                {s.completed}/{s.total}
              </span>
            </button>
          )
        })}
        {nextLockedPhase && (
          <span
            className="shrink-0 flex flex-col items-center px-4 py-2.5 whitespace-nowrap opacity-30"
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              borderBottom: '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {phaseLabels[nextLockedPhase]}
            </span>
          </span>
        )}
      </div>

      {/* 선택된 라운드 경기 목록 */}
      {selectedPhase && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {selectedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              currentUserEntryIds={currentUserEntryIds}
              onScoreInput={onScoreInput}
              isMatchInProgress={isMatchInProgress}
              matchType={matchType}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 경기 카드
// ============================================================================
function isMyEntry(entryId: string | null, currentUserEntryIds?: string[]): boolean {
  if (!entryId || !currentUserEntryIds) return false
  return currentUserEntryIds.includes(entryId)
}

// 참가자 이름 — 단체전: 팀명(club_name), 복식: "선수 & 파트너", 단식: 선수명
function teamName(team: BracketMatch['team1'], matchType?: MatchType | null): string {
  if (!team) return 'TBD'
  if (matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') {
    return team.club_name || team.player_name
  }
  if (team.partner_data) {
    return `${team.player_name} & ${team.partner_data.name}`
  }
  return team.player_name
}

function MatchCard({
  match,
  currentUserEntryIds,
  onScoreInput,
  isMatchInProgress,
  matchType,
}: {
  match: BracketMatch
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
  isMatchInProgress?: (match: BracketMatch) => boolean
  matchType?: MatchType | null
}) {
  const isCompleted = match.status === 'COMPLETED'
  const isBye = match.status === 'BYE'

  const isMyMatch = isMyEntry(match.team1_entry_id, currentUserEntryIds) || isMyEntry(match.team2_entry_id, currentUserEntryIds)
  // isMatchInProgress: 관리자가 활성화한 라운드에 해당하는 경기만 점수 입력 가능
  const inProgress = isMatchInProgress?.(match) ?? false
  const canInputScore = isMyMatch
    && (match.status === 'SCHEDULED' || match.status === 'COMPLETED')
    && match.team1_entry_id && match.team2_entry_id
    && inProgress

  const team1Text = teamName(match.team1, matchType)
  const team2Text = teamName(match.team2, matchType)

  const hasCourt = match.court_location || match.court_number
  const team1IsMe = isMyEntry(match.team1_entry_id, currentUserEntryIds)
  const team2IsMe = isMyEntry(match.team2_entry_id, currentUserEntryIds)
  const team1IsWinner = match.winner_entry_id === match.team1_entry_id
  const team2IsWinner = match.winner_entry_id === match.team2_entry_id

  if (isBye) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-(--bg-secondary) border border-(--border-color)">
        <span className="text-xs text-(--text-muted) font-mono">#{match.match_number}</span>
        <span className="text-sm text-(--text-primary)">{team1Text}</span>
        <span className="text-xs text-(--text-muted)">(부전승)</span>
      </div>
    )
  }

  const team1Color = team1IsMe
    ? 'text-(--accent-color) font-bold'
    : team1IsWinner
      ? 'text-(--text-primary) font-bold'
      : 'text-(--text-secondary)'

  const team2Color = team2IsMe
    ? 'text-(--accent-color) font-bold'
    : team2IsWinner
      ? 'text-(--text-primary) font-bold'
      : 'text-(--text-secondary)'

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all ${
        isMyMatch
          ? 'border-2 border-(--accent-color) bg-(--accent-color)/5'
          : isCompleted
            ? 'bg-(--bg-secondary) border border-(--border-color) opacity-80'
            : 'bg-(--bg-secondary) border border-(--border-color)'
      }`}
    >
      <div className="px-4 py-3 space-y-1.5">
        {/* 매치 번호 */}
        <span className="text-xs text-(--text-muted) font-mono">#{match.match_number}</span>

        {/* 팀1 행 */}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm min-w-0 break-words ${team1Color}`}>
            {team1Text}
          </span>
          <span className={`font-mono text-base tabular-nums shrink-0 ${
            team1IsWinner ? 'font-bold text-(--text-primary)' : 'text-(--text-muted)'
          }`}>
            {match.team1_score ?? '-'}
          </span>
        </div>

        {/* 팀2 행 */}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm min-w-0 break-words ${team2Color}`}>
            {team2Text}
          </span>
          <span className={`font-mono text-base tabular-nums shrink-0 ${
            team2IsWinner ? 'font-bold text-(--text-primary)' : 'text-(--text-muted)'
          }`}>
            {match.team2_score ?? '-'}
          </span>
        </div>
      </div>

      {/* 코트 정보 */}
      {hasCourt && (
        <div className="border-t border-(--border-color)/50 px-4 py-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-(--court-info) shrink-0" />
          <span className="text-sm font-medium text-(--court-info)">
            {[match.court_location, match.court_number ? `${match.court_number}번` : null]
              .filter(Boolean)
              .join(' | ')}
          </span>
        </div>
      )}

      {/* 결과 입력 버튼 — 내 경기 + 관리자가 활성화한 라운드에만 표시 */}
      {canInputScore && onScoreInput && (
        <div className="border-t border-(--accent-color)/20 px-4 py-2">
          <button
            type="button"
            onClick={() => onScoreInput(match)}
            aria-label={`${match.match_number}번 경기 결과 입력`}
            className="w-full text-sm font-display tracking-wider py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
          >
            결과 입력
          </button>
        </div>
      )}
    </div>
  )
}

