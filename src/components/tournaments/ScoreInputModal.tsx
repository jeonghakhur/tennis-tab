'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/common/Modal'
import type { MatchType, SetDetail } from '@/lib/supabase/types'

// BracketView와 동일한 매치 인터페이스 (필요한 필드만)
interface BracketMatch {
  id: string
  match_number: number
  team1_entry_id: string | null
  team2_entry_id: string | null
  team1_score: number | null
  team2_score: number | null
  status: string
  sets_detail: SetDetail[] | null
  team1?: {
    id: string
    player_name: string
    club_name: string | null
    partner_data?: { name: string; rating: number; club: string | null } | null
    team_members?: { name: string; rating: number }[] | null
  }
  team2?: {
    id: string
    player_name: string
    club_name: string | null
    partner_data?: { name: string; rating: number; club: string | null } | null
    team_members?: { name: string; rating: number }[] | null
  }
}

interface ScoreInputModalProps {
  isOpen: boolean
  onClose: () => void
  match: BracketMatch
  matchType: MatchType | null
  teamMatchCount: number | null
  onSubmit: (team1Score: number, team2Score: number, setsDetail?: SetDetail[]) => void
}

const PLAYERS_PER_TEAM = {
  TEAM_SINGLES: 1,
  TEAM_DOUBLES: 2,
} as const

// 단체전 여부 판별
function isTeamMatch(matchType: MatchType | null): boolean {
  return matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES'
}

// 팀 라벨 (복식: "선수A & 선수B", 단체전: 클럽명, 단식: 선수명)
function getTeamLabel(team: BracketMatch['team1']): string {
  if (!team) return 'TBD'
  if (team.partner_data) {
    return `${team.player_name} & ${team.partner_data.name}`
  }
  return team.club_name || team.player_name || 'TBD'
}

export function ScoreInputModal({
  isOpen,
  onClose,
  match,
  matchType,
  teamMatchCount,
  onSubmit,
}: ScoreInputModalProps) {
  const team1Label = getTeamLabel(match.team1)
  const team2Label = getTeamLabel(match.team2)

  // 단체전이면 세트별 입력, 아니면 단순 점수 입력
  if (isTeamMatch(matchType) && teamMatchCount && teamMatchCount > 0) {
    return (
      <TeamScoreInput
        isOpen={isOpen}
        onClose={onClose}
        match={match}
        matchType={matchType!}
        teamMatchCount={teamMatchCount}
        team1Label={team1Label}
        team2Label={team2Label}
        onSubmit={onSubmit}
      />
    )
  }

  return (
    <SimpleScoreInput
      isOpen={isOpen}
      onClose={onClose}
      match={match}
      team1Label={team1Label}
      team2Label={team2Label}
      onSubmit={onSubmit}
    />
  )
}

// ============================================================================
// 개인전/복식 단순 점수 입력
// ============================================================================
function SimpleScoreInput({
  isOpen,
  onClose,
  match,
  team1Label,
  team2Label,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  match: BracketMatch
  team1Label: string
  team2Label: string
  onSubmit: (team1Score: number, team2Score: number) => void
}) {
  const [team1Score, setTeam1Score] = useState<string>('')
  const [team2Score, setTeam2Score] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTeam1Score(match.team1_score?.toString() ?? '')
      setTeam2Score(match.team2_score?.toString() ?? '')
      setSubmitting(false)
    }
  }, [isOpen, match.id])

  const score1 = team1Score === '' ? null : parseInt(team1Score)
  const score2 = team2Score === '' ? null : parseInt(team2Score)

  // 검증: 둘 다 입력됨 + 0 이상 + 동점 아님
  const canSave = score1 !== null && score2 !== null
    && score1 >= 0 && score2 >= 0
    && score1 !== score2

  const isTied = score1 !== null && score2 !== null && score1 === score2

  const handleSave = async () => {
    if (!canSave || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(score1!, score2!)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`점수 입력 - #${match.match_number}`}
      description={`${team1Label} vs ${team2Label}`}
      size="sm"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* 팀1 점수 */}
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium text-(--text-primary) truncate">
              {team1Label}
            </span>
            <input
              type="number"
              min="0"
              value={team1Score}
              onChange={(e) => setTeam1Score(e.target.value)}
              placeholder="0"
              className="w-20 px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-lg font-mono"
            />
          </div>

          {/* VS 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-(--border-color)" />
            <span className="text-(--text-muted) text-sm font-medium">vs</span>
            <div className="flex-1 h-px bg-(--border-color)" />
          </div>

          {/* 팀2 점수 */}
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium text-(--text-primary) truncate">
              {team2Label}
            </span>
            <input
              type="number"
              min="0"
              value={team2Score}
              onChange={(e) => setTeam2Score(e.target.value)}
              placeholder="0"
              className="w-20 px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-lg font-mono"
            />
          </div>

          {/* 동점 경고 */}
          {isTied && (
            <p className="text-sm text-rose-400 text-center">
              동점은 허용되지 않습니다.
            </p>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-secondary)/80 transition-colors font-medium"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || submitting}
          className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ============================================================================
// 단체전 세트별 점수 입력 (MatchDetailModal 로직 참고)
// ============================================================================
function TeamScoreInput({
  isOpen,
  onClose,
  match,
  matchType,
  teamMatchCount,
  team1Label,
  team2Label,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  match: BracketMatch
  matchType: MatchType
  teamMatchCount: number
  team1Label: string
  team2Label: string
  onSubmit: (team1Score: number, team2Score: number, setsDetail?: SetDetail[]) => void
}) {
  const playersPerTeam = matchType === 'TEAM_DOUBLES'
    ? PLAYERS_PER_TEAM.TEAM_DOUBLES
    : PLAYERS_PER_TEAM.TEAM_SINGLES
  const [submitting, setSubmitting] = useState(false)

  // 세트 초기화
  const createInitialSets = (): SetDetail[] => {
    if (match.sets_detail && match.sets_detail.length > 0) {
      return match.sets_detail.map((s) => ({
        set_number: s.set_number,
        team1_players: [...s.team1_players],
        team2_players: [...s.team2_players],
        team1_score: s.team1_score,
        team2_score: s.team2_score,
      }))
    }

    return Array.from({ length: teamMatchCount }, (_, i) => ({
      set_number: i + 1,
      team1_players: Array(playersPerTeam).fill(''),
      team2_players: Array(playersPerTeam).fill(''),
      team1_score: null,
      team2_score: null,
    }))
  }

  const [sets, setSets] = useState<SetDetail[]>(createInitialSets)

  useEffect(() => {
    if (isOpen) {
      setSets(createInitialSets())
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, match.id])

  // 팀별 선수 목록
  const team1Players = useMemo(() => {
    if (!match.team1) return []
    const players = [match.team1.player_name]
    if (match.team1.team_members) {
      players.push(...match.team1.team_members.map((m) => m.name))
    }
    return players
  }, [match.team1])

  const team2Players = useMemo(() => {
    if (!match.team2) return []
    const players = [match.team2.player_name]
    if (match.team2.team_members) {
      players.push(...match.team2.team_members.map((m) => m.name))
    }
    return players
  }, [match.team2])

  // Best-of-N 로직
  const winsNeeded = Math.ceil(teamMatchCount / 2)

  const { team1Wins, team2Wins, matchDecided } = useMemo(() => {
    let t1 = 0
    let t2 = 0
    for (const set of sets) {
      if (set.team1_score !== null && set.team2_score !== null) {
        if (set.team1_score > set.team2_score) t1++
        else if (set.team2_score > set.team1_score) t2++
      }
    }
    return { team1Wins: t1, team2Wins: t2, matchDecided: t1 >= winsNeeded || t2 >= winsNeeded }
  }, [sets, winsNeeded])

  // 앞선 세트까지 승부 결정 시 비활성화
  const isSetDisabled = (setIndex: number): boolean => {
    let t1 = 0
    let t2 = 0
    for (let i = 0; i < setIndex; i++) {
      const s = sets[i]
      if (s.team1_score !== null && s.team2_score !== null) {
        if (s.team1_score > s.team2_score) t1++
        else if (s.team2_score > s.team1_score) t2++
      }
    }
    return t1 >= winsNeeded || t2 >= winsNeeded
  }

  // 복식: 이전 세트에서 사용된 선수 (중복 방지)
  const isPlayerDisabled = (
    setIndex: number,
    team: 'team1' | 'team2',
    playerName: string,
  ): boolean => {
    if (matchType !== 'TEAM_DOUBLES') return false

    const currentSet = sets[setIndex]
    const currentPlayers = team === 'team1' ? currentSet.team1_players : currentSet.team2_players
    const used = new Set<string>()

    // 이전 세트에서 사용된 선수
    for (let i = 0; i < setIndex; i++) {
      const s = sets[i]
      const players = team === 'team1' ? s.team1_players : s.team2_players
      players.forEach((p) => p && used.add(p))
    }

    if (used.has(playerName)) return true
    // 같은 세트 내 이미 선택된 선수
    if (currentPlayers.filter((p) => p === playerName).length > 0) return true

    return false
  }

  // 세트 업데이트 헬퍼
  const updateSet = (index: number, updates: Partial<SetDetail>) => {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const updatePlayer = (setIndex: number, team: 'team1' | 'team2', playerIndex: number, value: string) => {
    setSets((prev) =>
      prev.map((s, i) => {
        if (i !== setIndex) return s
        const key = team === 'team1' ? 'team1_players' : 'team2_players'
        const newPlayers = [...s[key]]
        newPlayers[playerIndex] = value
        return { ...s, [key]: newPlayers }
      }),
    )
  }

  // 저장 가능 여부
  const canSave = useMemo(() => {
    if (!matchDecided) return false

    for (const set of sets) {
      if (isSetDisabled(set.set_number - 1)) break
      if (set.team1_score === null || set.team2_score === null) return false
      if (set.team1_score === set.team2_score) return false
      if (set.team1_players.some((p) => !p)) return false
      if (set.team2_players.some((p) => !p)) return false
    }

    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, matchDecided])

  const handleSave = async () => {
    if (!canSave || submitting) return
    setSubmitting(true)
    try {
      const validSets = sets.filter((_, i) => !isSetDisabled(i))
      await onSubmit(team1Wins, team2Wins, validSets)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`경기 결과 입력 - #${match.match_number}`}
      description={`${team1Label} vs ${team2Label}`}
      size="lg"
    >
      <Modal.Body>
        {/* 승수 표시 */}
        <div className="flex items-center justify-center gap-4 py-3 mb-5 bg-(--bg-secondary)/50 rounded-lg -mx-5 px-5">
          <span className={`text-sm font-bold ${team1Wins >= winsNeeded ? 'text-emerald-400' : 'text-(--text-primary)'}`}>
            {team1Label} {team1Wins}승
          </span>
          <span className="text-(--text-muted)">:</span>
          <span className={`text-sm font-bold ${team2Wins >= winsNeeded ? 'text-emerald-400' : 'text-(--text-primary)'}`}>
            {team2Label} {team2Wins}승
          </span>
        </div>

        {/* 세트별 입력 */}
        <div className="space-y-5">
          {sets.map((set, setIndex) => {
            const disabled = isSetDisabled(setIndex)
            return (
              <div
                key={set.set_number}
                className={`rounded-xl border p-4 transition-opacity ${
                  disabled
                    ? 'opacity-40 border-(--border-color)/50 bg-(--bg-secondary)/30'
                    : 'border-(--border-color) bg-(--bg-secondary)/50'
                }`}
              >
                <h4 className="text-sm font-semibold text-(--text-primary) mb-3">
                  세트 {set.set_number}
                  {disabled && (
                    <span className="ml-2 text-xs text-(--text-muted) font-normal">(승부 결정)</span>
                  )}
                </h4>

                {/* 선수 선택 + 점수 */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                  {/* 팀1 */}
                  <div className="space-y-2">
                    <label className="text-xs text-(--text-muted) block">{team1Label}</label>
                    {Array.from({ length: playersPerTeam }, (_, pIdx) => (
                      <select
                        key={`t1-${pIdx}`}
                        value={set.team1_players[pIdx] || ''}
                        onChange={(e) => updatePlayer(setIndex, 'team1', pIdx, e.target.value)}
                        disabled={disabled}
                        className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-sm disabled:opacity-50"
                      >
                        <option value="">선수 선택</option>
                        {team1Players.map((name) => (
                          <option key={name} value={name} disabled={isPlayerDisabled(setIndex, 'team1', name)}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ))}
                    <input
                      type="number"
                      min="0"
                      value={set.team1_score ?? ''}
                      onChange={(e) => updateSet(setIndex, { team1_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                      disabled={disabled}
                      placeholder="점수"
                      className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-sm disabled:opacity-50"
                    />
                  </div>

                  {/* VS */}
                  <div className="flex items-center justify-center pb-1">
                    <span className="text-(--text-muted) text-sm font-medium">vs</span>
                  </div>

                  {/* 팀2 */}
                  <div className="space-y-2">
                    <label className="text-xs text-(--text-muted) block">{team2Label}</label>
                    {Array.from({ length: playersPerTeam }, (_, pIdx) => (
                      <select
                        key={`t2-${pIdx}`}
                        value={set.team2_players[pIdx] || ''}
                        onChange={(e) => updatePlayer(setIndex, 'team2', pIdx, e.target.value)}
                        disabled={disabled}
                        className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-sm disabled:opacity-50"
                      >
                        <option value="">선수 선택</option>
                        {team2Players.map((name) => (
                          <option key={name} value={name} disabled={isPlayerDisabled(setIndex, 'team2', name)}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ))}
                    <input
                      type="number"
                      min="0"
                      value={set.team2_score ?? ''}
                      onChange={(e) => updateSet(setIndex, { team2_score: e.target.value === '' ? null : parseInt(e.target.value) })}
                      disabled={disabled}
                      placeholder="점수"
                      className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-secondary)/80 transition-colors font-medium"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || submitting}
          className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
