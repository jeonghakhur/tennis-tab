'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Trophy, Users, RefreshCw, Lock, ChevronRight, MapPin } from 'lucide-react'
import { getBracketData, submitPlayerScore } from '@/lib/bracket/actions'
import { useMatchesRealtime } from '@/lib/realtime/useMatchesRealtime'
import { ScoreInputModal } from '@/components/tournaments/ScoreInputModal'
import { Toast } from '@/components/common/AlertDialog'
import type { BracketStatus, MatchPhase, MatchStatus, MatchType, SetDetail } from '@/lib/supabase/types'

interface Division {
  id: string
  name: string
  max_teams: number | null
}

interface BracketViewProps {
  tournamentId: string
  divisions: Division[]
  // 선수용 props (선택적 — 비로그인 시 undefined)
  currentUserEntryIds?: string[]
  matchType?: MatchType | null
  teamMatchCount?: number | null
}

interface BracketConfig {
  id: string
  has_preliminaries: boolean
  third_place_match: boolean
  bracket_size: number | null
  status: BracketStatus
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

export function BracketView({ tournamentId, divisions, currentUserEntryIds, matchType, teamMatchCount }: BracketViewProps) {
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(
    divisions.length > 0 ? divisions[0] : null
  )
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
      const data = await getBracketData(selectedDivision.id)
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
      // 데이터 로딩 실패 — 빈 상태 유지
    } finally {
      setLoading(false)
    }
  }

  // Realtime 구독 — 다른 선수의 점수 입력도 실시간 반영
  const handleMatchUpdate = useCallback((updatedMatch: BracketMatch) => {
    setMatches((prev) =>
      prev?.map((m) => (m.id === updatedMatch.id ? updatedMatch : m)) || null
    )
  }, [])

  useMatchesRealtime({
    bracketConfigId: config?.id || "",
    onMatchUpdate: handleMatchUpdate,
    enabled: !!config?.id,
  })

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
    // Realtime이 자동으로 업데이트하므로 리페치 불필요
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
      <div className="flex flex-wrap gap-2">
        {divisions.map((division) => (
          <button
            key={division.id}
            onClick={() => setSelectedDivision(division)}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-white ${
              selectedDivision?.id === division.id
                ? 'bg-(--accent-color)'
                : 'bg-(--bg-card) hover:bg-(--bg-card-hover)'
            }`}
          >
            {division.name}
          </button>
        ))}
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
            <div className="flex gap-1 p-1 bg-(--bg-card) rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('preliminary')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-white ${
                  activeTab === 'preliminary'
                    ? 'bg-(--accent-color)'
                    : 'hover:bg-white/10'
                }`}
              >
                <Users className="w-4 h-4" />
                예선
              </button>
              <button
                onClick={() => setActiveTab('main')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-white ${
                  activeTab === 'main'
                    ? 'bg-(--accent-color)'
                    : 'hover:bg-white/10'
                }`}
              >
                <Trophy className="w-4 h-4" />
                본선
              </button>
            </div>
          )}

          {/* Content */}
          {activeTab === 'preliminary' && config.has_preliminaries ? (
            <PreliminaryView
              groups={groups || []}
              matches={preliminaryMatches}
              currentUserEntryIds={currentUserEntryIds}
              onScoreInput={setScoreModalMatch}
            />
          ) : (
            <MainBracketView
              config={config}
              matches={mainMatches}
              currentUserEntryIds={currentUserEntryIds}
              onScoreInput={setScoreModalMatch}
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
}: {
  groups: PreliminaryGroup[]
  matches: BracketMatch[]
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
}) {
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
      {groups.map((group) => {
        const groupMatches = matches.filter((m) => m.group_id === group.id)
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
                          <p className={`font-medium ${isMe ? 'text-(--accent-color)' : 'text-(--text-primary)'}`}>
                            {team.entry?.player_name}{isMe ? ' (나)' : ''}
                          </p>
                          {team.entry?.partner_data && (
                            <p className={`text-xs ${isMe ? 'text-(--accent-color)/70' : 'text-(--text-muted)'}`}>
                              {team.entry.partner_data.name}
                            </p>
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
}: {
  config: BracketConfig
  matches: BracketMatch[]
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
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
  const phaseStatus = useMemo(() => {
    const status: Record<string, { playable: boolean; completed: number; total: number; allDone: boolean }> = {}
    for (const phase of activePhases) {
      const phaseMatches = matchesByPhase[phase] || []
      const hasTeams = phaseMatches.some((m) => m.team1_entry_id || m.team2_entry_id)
      const completed = phaseMatches.filter((m) => m.status === 'COMPLETED' || m.status === 'BYE').length
      status[phase] = { playable: hasTeams, completed, total: phaseMatches.length, allDone: completed === phaseMatches.length }
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

  // 선택된 라운드 (기본: 현재 활성 라운드)
  const [selectedPhase, setSelectedPhase] = useState<MatchPhase | null>(currentPhase)

  // 데이터 갱신 시 selectedPhase 보정
  useEffect(() => {
    if (!selectedPhase || !visiblePhases.includes(selectedPhase)) {
      setSelectedPhase(currentPhase)
    }
  }, [visiblePhases, selectedPhase, currentPhase])

  if (matches.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">본선 대진표가 아직 생성되지 않았습니다.</p>
      </div>
    )
  }

  const selectedMatches = selectedPhase ? (matchesByPhase[selectedPhase] || []) : []
  // 다음 미개방 라운드 이름 (표시용)
  const nextLockedPhase = activePhases.find((phase) => !visiblePhases.includes(phase))

  return (
    <div className="space-y-6">
      {/* 라운드 탭 — 완료 + 현재 진행 라운드만 표시 */}
      <div className="flex flex-wrap items-center gap-2">
        {visiblePhases.map((phase, index) => {
          const s = phaseStatus[phase]
          const isSelected = selectedPhase === phase
          const isCurrent = phase === currentPhase && !s.allDone

          return (
            <div key={phase} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-(--text-muted)" />}
              <button
                onClick={() => setSelectedPhase(phase)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-(--accent-color) text-white'
                    : s.allDone
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-(--bg-card) text-(--text-primary) hover:bg-(--bg-card-hover)'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {phaseLabels[phase]}
                  <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-(--text-muted)'}`}>
                    {s.completed}/{s.total}
                  </span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-(--accent-color) animate-pulse" />
                  )}
                </span>
              </button>
            </div>
          )
        })}
        {/* 다음 잠긴 라운드 표시 */}
        {nextLockedPhase && (
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-(--text-muted)" />
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-(--bg-secondary) text-(--text-muted) opacity-50">
              <Lock className="w-3 h-3" />
              {phaseLabels[nextLockedPhase]}
            </span>
          </div>
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

// 참가자 이름 (복식: "참가자 & 파트너")
function teamName(team: BracketMatch['team1']): string {
  if (!team) return 'TBD'
  if (team.partner_data) {
    return `${team.player_name} & ${team.partner_data.name}`
  }
  return team.player_name
}

function MatchCard({
  match,
  currentUserEntryIds,
  onScoreInput,
}: {
  match: BracketMatch
  currentUserEntryIds?: string[]
  onScoreInput?: (match: BracketMatch) => void
}) {
  const isCompleted = match.status === 'COMPLETED'
  const isBye = match.status === 'BYE'

  const isMyMatch = isMyEntry(match.team1_entry_id, currentUserEntryIds) || isMyEntry(match.team2_entry_id, currentUserEntryIds)
  const canInputScore = isMyMatch && (match.status === 'SCHEDULED' || match.status === 'COMPLETED')
    && match.team1_entry_id && match.team2_entry_id

  const team1Text = teamName(match.team1)
  const team2Text = teamName(match.team2)

  const hasCourt = match.court_location || match.court_number
  const team1IsMe = isMyEntry(match.team1_entry_id, currentUserEntryIds)
  const team2IsMe = isMyEntry(match.team2_entry_id, currentUserEntryIds)
  const team1IsWinner = match.winner_entry_id === match.team1_entry_id
  const team2IsWinner = match.winner_entry_id === match.team2_entry_id

  if (isBye) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-(--bg-secondary) opacity-60 border border-(--border-color)">
        <span className="text-xs text-(--text-muted) font-mono">#{match.match_number}</span>
        <span className="text-sm text-(--text-primary)">{team1Text}</span>
        <span className="text-xs text-(--text-muted)">(부전승)</span>
      </div>
    )
  }

  const handleClick = () => {
    if (canInputScore && onScoreInput) {
      onScoreInput(match)
    }
  }

  const team1Color = team1IsMe
    ? 'text-(--accent-color) font-bold'
    : team1IsWinner
      ? 'text-emerald-400 font-bold'
      : 'text-(--text-primary)'

  const team2Color = team2IsMe
    ? 'text-(--accent-color) font-bold'
    : team2IsWinner
      ? 'text-emerald-400 font-bold'
      : 'text-(--text-primary)'

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all ${
        isMyMatch
          ? canInputScore
            ? 'border-2 border-(--accent-color) bg-(--accent-color)/5 cursor-pointer hover:bg-(--accent-color)/10 active:scale-[0.99]'
            : 'border-2 border-(--accent-color) bg-(--accent-color)/5'
          : isCompleted
            ? 'bg-emerald-500/5 border border-emerald-500/20'
            : 'bg-(--bg-secondary) border border-(--border-color)'
      }`}
      onClick={handleClick}
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
            team1IsWinner ? 'font-bold text-emerald-400' : 'text-(--text-primary)'
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
            team2IsWinner ? 'font-bold text-emerald-400' : 'text-(--text-primary)'
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
    </div>
  )
}

