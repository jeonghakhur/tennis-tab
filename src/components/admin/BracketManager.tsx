'use client'

import { useState, useEffect } from 'react'
import { Settings, Users, Trophy, Play, Check, RefreshCw } from 'lucide-react'
import {
  getOrCreateBracketConfig,
  updateBracketConfig,
  autoGenerateGroups,
  getPreliminaryGroups,
  generatePreliminaryMatches,
  getPreliminaryMatches,
  generateMainBracket,
  getMainBracketMatches,
  updateMatchResult,
} from '@/lib/bracket/actions'
import type { BracketStatus, MatchPhase, MatchStatus } from '@/lib/supabase/types'

interface Division {
  id: string
  name: string
  max_teams: number | null
}

interface BracketManagerProps {
  tournamentId: string
  divisions: Division[]
}

interface BracketConfig {
  id: string
  division_id: string
  has_preliminaries: boolean
  third_place_match: boolean
  bracket_size: number | null
  status: BracketStatus
}

interface GroupTeam {
  id: string
  entry_id: string
  seed_number: number | null
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

export function BracketManager({ tournamentId, divisions }: BracketManagerProps) {
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(
    divisions.length > 0 ? divisions[0] : null
  )
  const [config, setConfig] = useState<BracketConfig | null>(null)
  const [groups, setGroups] = useState<PreliminaryGroup[]>([])
  const [preliminaryMatches, setPreliminaryMatches] = useState<BracketMatch[]>([])
  const [mainMatches, setMainMatches] = useState<BracketMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'groups' | 'preliminary' | 'main'>('settings')

  // 부서 변경 시 데이터 로드
  useEffect(() => {
    if (selectedDivision) {
      loadBracketData()
    }
  }, [selectedDivision])

  const loadBracketData = async () => {
    if (!selectedDivision) return
    setLoading(true)

    try {
      // 대진표 설정 로드
      const { data: configData } = await getOrCreateBracketConfig(selectedDivision.id)
      if (configData) {
        setConfig(configData)

        // 예선 조 로드
        if (configData.has_preliminaries) {
          const { data: groupsData } = await getPreliminaryGroups(configData.id)
          setGroups(groupsData || [])

          const { data: prelimData } = await getPreliminaryMatches(configData.id)
          setPreliminaryMatches(prelimData || [])
        }

        // 본선 경기 로드
        const { data: mainData } = await getMainBracketMatches(configData.id)
        setMainMatches(mainData || [])
      }
    } catch (error) {
      console.error('Failed to load bracket data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigUpdate = async (updates: Partial<BracketConfig>) => {
    if (!config) return
    setLoading(true)

    try {
      const { data } = await updateBracketConfig(config.id, updates)
      if (data) {
        setConfig(data)
      }
    } catch (error) {
      console.error('Failed to update config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoGenerateGroups = async () => {
    if (!config || !selectedDivision) return
    if (!confirm('자동 조 편성을 하시겠습니까? 기존 조 편성이 삭제됩니다.')) return

    setLoading(true)
    try {
      const { error } = await autoGenerateGroups(config.id, selectedDivision.id)
      if (error) {
        alert(error)
      } else {
        await loadBracketData()
        setActiveTab('groups')
      }
    } catch (error) {
      console.error('Failed to generate groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePreliminaryMatches = async () => {
    if (!config) return
    if (!confirm('예선 경기를 생성하시겠습니까?')) return

    setLoading(true)
    try {
      const { error } = await generatePreliminaryMatches(config.id)
      if (error) {
        alert(error)
      } else {
        await loadBracketData()
        setActiveTab('preliminary')
      }
    } catch (error) {
      console.error('Failed to generate preliminary matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateMainBracket = async () => {
    if (!config || !selectedDivision) return
    if (!confirm('본선 대진표를 생성하시겠습니까?')) return

    setLoading(true)
    try {
      const { data, error } = await generateMainBracket(config.id, selectedDivision.id)
      if (error) {
        alert(error)
      } else {
        alert(`본선 대진표가 생성되었습니다. (${data?.bracketSize}강, ${data?.teamCount}팀)`)
        await loadBracketData()
        setActiveTab('main')
      }
    } catch (error) {
      console.error('Failed to generate main bracket:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMatchResult = async (matchId: string, team1Score: number, team2Score: number) => {
    setLoading(true)
    try {
      const { error } = await updateMatchResult(matchId, team1Score, team2Score)
      if (error) {
        alert(error)
      } else {
        await loadBracketData()
      }
    } catch (error) {
      console.error('Failed to update match result:', error)
    } finally {
      setLoading(false)
    }
  }

  if (divisions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
        <p className="text-[var(--text-secondary)]">
          대진표를 생성하려면 먼저 참가 부서를 추가해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Division Selector */}
      <div className="flex flex-wrap gap-2">
        {divisions.map((division) => (
          <button
            key={division.id}
            onClick={() => setSelectedDivision(division)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedDivision?.id === division.id
                ? 'bg-[var(--accent-color)] text-black'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            {division.name}
          </button>
        ))}
      </div>

      {selectedDivision && config && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[var(--bg-card)] rounded-xl">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-[var(--accent-color)] text-black'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Settings className="w-4 h-4" />
              설정
            </button>
            {config.has_preliminaries && (
              <>
                <button
                  onClick={() => setActiveTab('groups')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'groups'
                      ? 'bg-[var(--accent-color)] text-black'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  조 편성
                </button>
                <button
                  onClick={() => setActiveTab('preliminary')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'preliminary'
                      ? 'bg-[var(--accent-color)] text-black'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  예선
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('main')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'main'
                  ? 'bg-[var(--accent-color)] text-black'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Trophy className="w-4 h-4" />
              본선
            </button>
          </div>

          {/* Tab Content */}
          <div className="glass-card rounded-xl p-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-color)]" />
              </div>
            )}

            {!loading && activeTab === 'settings' && (
              <SettingsTab
                config={config}
                onUpdate={handleConfigUpdate}
              />
            )}

            {!loading && activeTab === 'groups' && (
              <GroupsTab
                groups={groups}
                onAutoGenerate={handleAutoGenerateGroups}
                onGenerateMatches={handleGeneratePreliminaryMatches}
              />
            )}

            {!loading && activeTab === 'preliminary' && (
              <PreliminaryTab
                groups={groups}
                matches={preliminaryMatches}
                onMatchResult={handleMatchResult}
              />
            )}

            {!loading && activeTab === 'main' && (
              <MainBracketTab
                config={config}
                matches={mainMatches}
                onGenerateBracket={handleGenerateMainBracket}
                onMatchResult={handleMatchResult}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// 설정 탭
// ============================================================================
function SettingsTab({
  config,
  onUpdate,
}: {
  config: BracketConfig
  onUpdate: (updates: Partial<BracketConfig>) => void
}) {
  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        대진표 설정
      </h3>

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.has_preliminaries}
            onChange={(e) => onUpdate({ has_preliminaries: e.target.checked })}
            disabled={config.status !== 'DRAFT'}
            className="w-5 h-5 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
          />
          <span className="text-[var(--text-primary)]">예선전 진행</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.third_place_match}
            onChange={(e) => onUpdate({ third_place_match: e.target.checked })}
            disabled={config.status === 'COMPLETED'}
            className="w-5 h-5 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
          />
          <span className="text-[var(--text-primary)]">3/4위전 진행</span>
        </label>
      </div>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">상태:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            config.status === 'DRAFT' ? 'bg-gray-500/20 text-gray-400' :
            config.status === 'PRELIMINARY' ? 'bg-amber-500/20 text-amber-400' :
            config.status === 'MAIN' ? 'bg-blue-500/20 text-blue-400' :
            'bg-emerald-500/20 text-emerald-400'
          }`}>
            {config.status === 'DRAFT' ? '준비중' :
             config.status === 'PRELIMINARY' ? '예선 진행중' :
             config.status === 'MAIN' ? '본선 진행중' : '완료'}
          </span>
        </div>
        {config.bracket_size && (
          <p className="text-sm text-[var(--text-muted)] mt-2">
            본선 대진표 크기: {config.bracket_size}강
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// 조 편성 탭
// ============================================================================
function GroupsTab({
  groups,
  onAutoGenerate,
  onGenerateMatches,
}: {
  groups: PreliminaryGroup[]
  onAutoGenerate: () => void
  onGenerateMatches: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
          예선 조 편성
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onAutoGenerate}
            className="btn-secondary btn-sm"
          >
            <span className="relative z-10">자동 편성</span>
          </button>
          {groups.length > 0 && (
            <button
              onClick={onGenerateMatches}
              className="btn-primary btn-sm"
            >
              <span className="relative z-10">예선 경기 생성</span>
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>조 편성이 없습니다. 자동 편성 버튼을 클릭하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]"
            >
              <h4 className="font-display font-semibold text-[var(--text-primary)] mb-3">
                {group.name}조
              </h4>
              <div className="space-y-2">
                {group.group_teams?.map((team, index) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {team.entry?.player_name}
                      </p>
                      {team.entry?.club_name && (
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {team.entry.club_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 예선 탭
// ============================================================================
function PreliminaryTab({
  groups,
  matches,
  onMatchResult,
}: {
  groups: PreliminaryGroup[]
  matches: BracketMatch[]
  onMatchResult: (matchId: string, team1Score: number, team2Score: number) => void
}) {
  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        예선 경기
      </h3>

      {matches.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>예선 경기가 없습니다. 조 편성 후 경기를 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupMatches = matches.filter((m) => m.group_id === group.id)
            const standings = group.group_teams
              ?.slice()
              .sort((a, b) => {
                if (a.final_rank && b.final_rank) return a.final_rank - b.final_rank
                return (b.wins - b.losses) - (a.wins - a.losses)
              })

            return (
              <div key={group.id} className="space-y-4">
                <h4 className="font-display font-semibold text-[var(--text-primary)]">
                  {group.name}조
                </h4>

                {/* 순위표 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                        <th className="text-left py-2 px-3">순위</th>
                        <th className="text-left py-2 px-3">팀</th>
                        <th className="text-center py-2 px-3">승</th>
                        <th className="text-center py-2 px-3">패</th>
                        <th className="text-center py-2 px-3">득점</th>
                        <th className="text-center py-2 px-3">실점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings?.map((team, index) => (
                        <tr key={team.id} className="border-b border-[var(--border-color)]">
                          <td className="py-2 px-3">
                            <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                              index < 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">
                            {team.entry?.player_name}
                          </td>
                          <td className="py-2 px-3 text-center text-[var(--text-primary)]">{team.wins}</td>
                          <td className="py-2 px-3 text-center text-[var(--text-primary)]">{team.losses}</td>
                          <td className="py-2 px-3 text-center text-[var(--text-primary)]">{team.points_for}</td>
                          <td className="py-2 px-3 text-center text-[var(--text-primary)]">{team.points_against}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 경기 목록 */}
                <div className="space-y-2">
                  {groupMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      onResult={onMatchResult}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 본선 탭
// ============================================================================
function MainBracketTab({
  config,
  matches,
  onGenerateBracket,
  onMatchResult,
}: {
  config: BracketConfig
  matches: BracketMatch[]
  onGenerateBracket: () => void
  onMatchResult: (matchId: string, team1Score: number, team2Score: number) => void
}) {
  // 라운드별로 경기 그룹화
  const matchesByPhase = matches.reduce((acc, match) => {
    if (!acc[match.phase]) acc[match.phase] = []
    acc[match.phase].push(match)
    return acc
  }, {} as Record<MatchPhase, BracketMatch[]>)

  const phaseOrder: MatchPhase[] = [
    'ROUND_128', 'ROUND_64', 'ROUND_32', 'ROUND_16',
    'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
          본선 대진표
          {config.bracket_size && (
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
              ({config.bracket_size}강)
            </span>
          )}
        </h3>
        {(config.status === 'DRAFT' || config.status === 'PRELIMINARY') && (
          <button
            onClick={onGenerateBracket}
            className="btn-primary btn-sm"
          >
            <span className="relative z-10">본선 대진표 생성</span>
          </button>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>본선 대진표가 없습니다.</p>
          {config.has_preliminaries && (
            <p className="text-sm mt-1">예선전 완료 후 본선 대진표를 생성하세요.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {phaseOrder.map((phase) => {
            const phaseMatches = matchesByPhase[phase]
            if (!phaseMatches || phaseMatches.length === 0) return null

            return (
              <div key={phase}>
                <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  {phaseLabels[phase]}
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    ({phaseMatches.length}경기)
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {phaseMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      onResult={onMatchResult}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 경기 행 컴포넌트
// ============================================================================
function MatchRow({
  match,
  onResult,
}: {
  match: BracketMatch
  onResult: (matchId: string, team1Score: number, team2Score: number) => void
}) {
  const [team1Score, setTeam1Score] = useState(match.team1_score?.toString() || '')
  const [team2Score, setTeam2Score] = useState(match.team2_score?.toString() || '')
  const [editing, setEditing] = useState(false)

  const handleSubmit = () => {
    const s1 = parseInt(team1Score) || 0
    const s2 = parseInt(team2Score) || 0
    if (s1 === s2) {
      alert('동점은 허용되지 않습니다.')
      return
    }
    onResult(match.id, s1, s2)
    setEditing(false)
  }

  if (match.status === 'BYE') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] opacity-60">
        <span className="text-xs text-[var(--text-muted)]">#{match.match_number}</span>
        <div className="flex-1">
          <span className="text-sm text-[var(--text-primary)]">
            {match.team1?.player_name || 'TBD'}
          </span>
          <span className="ml-2 text-xs text-[var(--text-muted)]">(부전승)</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      match.status === 'COMPLETED'
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
    }`}>
      <span className="text-xs text-[var(--text-muted)] w-8">#{match.match_number}</span>

      {/* Team 1 */}
      <div className={`flex-1 text-right ${
        match.winner_entry_id === match.team1_entry_id ? 'font-bold text-emerald-400' : 'text-[var(--text-primary)]'
      }`}>
        <span className="text-sm">
          {match.team1?.player_name || 'TBD'}
        </span>
      </div>

      {/* Score */}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(e.target.value)}
            className="w-12 px-2 py-1 text-center rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            min="0"
          />
          <span className="text-[var(--text-muted)]">:</span>
          <input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(e.target.value)}
            className="w-12 px-2 py-1 text-center rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
            min="0"
          />
          <button
            onClick={handleSubmit}
            className="p-1 rounded bg-emerald-500 text-white"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors"
          disabled={!match.team1_entry_id || !match.team2_entry_id}
        >
          <span className="text-[var(--text-primary)] font-mono">
            {match.team1_score ?? '-'}
          </span>
          <span className="text-[var(--text-muted)]">:</span>
          <span className="text-[var(--text-primary)] font-mono">
            {match.team2_score ?? '-'}
          </span>
        </button>
      )}

      {/* Team 2 */}
      <div className={`flex-1 text-left ${
        match.winner_entry_id === match.team2_entry_id ? 'font-bold text-emerald-400' : 'text-[var(--text-primary)]'
      }`}>
        <span className="text-sm">
          {match.team2?.player_name || 'TBD'}
        </span>
      </div>
    </div>
  )
}
