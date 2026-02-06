'use client'

import { useState, useEffect } from 'react'
import { Trophy, Users, RefreshCw } from 'lucide-react'
import { getBracketData } from '@/lib/bracket/actions'
import type { BracketStatus, MatchPhase, MatchStatus } from '@/lib/supabase/types'

interface Division {
  id: string
  name: string
  max_teams: number | null
}

interface BracketViewProps {
  tournamentId: string
  divisions: Division[]
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
  team1?: { id: string; player_name: string; club_name: string | null }
  team2?: { id: string; player_name: string; club_name: string | null }
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

export function BracketView({ tournamentId, divisions }: BracketViewProps) {
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(
    divisions.length > 0 ? divisions[0] : null
  )
  const [config, setConfig] = useState<BracketConfig | null>(null)
  const [groups, setGroups] = useState<PreliminaryGroup[] | null>(null)
  const [matches, setMatches] = useState<BracketMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'preliminary' | 'main'>('main')

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
    } catch (error) {
      console.error('Failed to load bracket data:', error)
    } finally {
      setLoading(false)
    }
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
            <PreliminaryView groups={groups || []} matches={preliminaryMatches} />
          ) : (
            <MainBracketView
              config={config}
              matches={mainMatches}
            />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// 예선 조별리그 뷰
// ============================================================================
function PreliminaryView({
  groups,
  matches,
}: {
  groups: PreliminaryGroup[]
  matches: BracketMatch[]
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
                  {standings?.map((team, index) => (
                    <tr key={team.id} className="border-b border-(--border-color)">
                      <td className="py-2 px-2">
                        <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                          index < 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-(--bg-secondary) text-(--text-muted)'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {team.entry?.club_name && (
                          <p className="font-medium text-(--text-primary)">{team.entry.club_name}</p>
                        )}
                        <p className={team.entry?.club_name ? 'text-xs text-(--text-muted)' : 'font-medium text-(--text-primary)'}>
                          {team.entry?.player_name}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-center text-emerald-400 font-medium">{team.wins}</td>
                      <td className="py-2 px-2 text-center text-rose-400 font-medium">{team.losses}</td>
                      <td className="py-2 px-2 text-center text-(--text-secondary)">
                        {team.points_for}/{team.points_against}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Match Results */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-(--text-muted) mb-2">경기 결과</h4>
              {groupMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
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
}: {
  config: BracketConfig
  matches: BracketMatch[]
}) {
  if (matches.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">본선 대진표가 아직 생성되지 않았습니다.</p>
      </div>
    )
  }

  // 라운드별로 그룹화
  const matchesByPhase = matches.reduce((acc, match) => {
    if (!acc[match.phase]) acc[match.phase] = []
    acc[match.phase].push(match)
    return acc
  }, {} as Record<MatchPhase, BracketMatch[]>)

  // 라운드 순서 (결승이 마지막)
  const phaseOrder: MatchPhase[] = [
    'ROUND_128', 'ROUND_64', 'ROUND_32', 'ROUND_16',
    'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'
  ]

  const activePahses = phaseOrder.filter((phase) => matchesByPhase[phase]?.length > 0)

  return (
    <div className="space-y-8">
      {/* Visual Bracket */}
      <div className="glass-card rounded-xl p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {activePahses.map((phase) => {
            const phaseMatches = matchesByPhase[phase] || []

            return (
              <div key={phase} className="flex flex-col gap-4">
                <h4 className="text-center font-semibold text-(--text-primary) sticky top-0 bg-(--bg-card) py-2">
                  {phaseLabels[phase]}
                </h4>
                <div className="flex flex-col gap-4 justify-around flex-1">
                  {phaseMatches.map((match) => (
                    <BracketMatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Match List (Mobile-friendly) */}
      <div className="lg:hidden space-y-6">
        {activePahses.map((phase) => {
          const phaseMatches = matchesByPhase[phase] || []

          return (
            <div key={phase}>
              <h4 className="font-display font-semibold text-(--text-primary) mb-3">
                {phaseLabels[phase]}
              </h4>
              <div className="space-y-2">
                {phaseMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// 경기 카드 (목록용)
// ============================================================================
function teamLabel(team: { player_name: string; club_name: string | null } | undefined, fallback: string) {
  if (!team) return fallback
  return team.club_name ? `${team.club_name} ${team.player_name}` : (team.player_name || fallback)
}

function MatchCard({ match }: { match: BracketMatch }) {
  const isCompleted = match.status === 'COMPLETED'
  const isBye = match.status === 'BYE'
  const team1Label = teamLabel(match.team1, 'TBD')
  const team2Label = teamLabel(match.team2, 'TBD')

  if (isBye) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-(--bg-secondary) opacity-60">
        <span className="text-(--text-primary) text-sm">
          {team1Label}
        </span>
        <span className="text-xs text-(--text-muted)">(부전승)</span>
      </div>
    )
  }

  return (
    <div className={`p-3 rounded-lg ${
      isCompleted ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-(--bg-secondary)'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex-1 ${
          match.winner_entry_id === match.team1_entry_id ? 'font-bold text-emerald-400' : 'text-(--text-primary)'
        }`}>
          <span className="text-sm">{team1Label}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-(--bg-card)">
          <span className="font-mono text-sm text-(--text-primary)">
            {match.team1_score ?? '-'}
          </span>
          <span className="text-(--text-muted)">:</span>
          <span className="font-mono text-sm text-(--text-primary)">
            {match.team2_score ?? '-'}
          </span>
        </div>
        <div className={`flex-1 text-right ${
          match.winner_entry_id === match.team2_entry_id ? 'font-bold text-emerald-400' : 'text-(--text-primary)'
        }`}>
          <span className="text-sm">{team2Label}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 대진표용 경기 카드
// ============================================================================
function BracketMatchCard({ match }: { match: BracketMatch }) {
  const isCompleted = match.status === 'COMPLETED'
  const isBye = match.status === 'BYE'
  const team1Label = teamLabel(match.team1, isBye ? '-' : 'TBD')
  const team2Label = teamLabel(match.team2, 'TBD')

  return (
    <div className={`w-48 rounded-lg overflow-hidden border ${
      isCompleted ? 'border-emerald-500/30' : 'border-(--border-color)'
    }`}>
      {/* Team 1 */}
      <div className={`flex items-center justify-between px-3 py-2 ${
        match.winner_entry_id === match.team1_entry_id
          ? 'bg-emerald-500/20 text-emerald-400 font-bold'
          : 'bg-(--bg-card) text-(--text-primary)'
      }`}>
        <span className="text-sm truncate flex-1">
          {team1Label}
        </span>
        <span className="font-mono text-sm ml-2">
          {isBye ? 'W' : (match.team1_score ?? '-')}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-(--border-color)" />

      {/* Team 2 */}
      <div className={`flex items-center justify-between px-3 py-2 ${
        match.winner_entry_id === match.team2_entry_id
          ? 'bg-emerald-500/20 text-emerald-400 font-bold'
          : 'bg-(--bg-card) text-(--text-primary)'
      }`}>
        <span className="text-sm truncate flex-1">
          {team2Label}
        </span>
        <span className="font-mono text-sm ml-2">
          {match.team2_score ?? '-'}
        </span>
      </div>
    </div>
  )
}
