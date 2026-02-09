"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/common/Modal";
import type { BracketMatch, SetDetail } from "./types";
import type { MatchType } from "@/lib/supabase/types";

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    matchId: string,
    team1Score: number,
    team2Score: number,
    setsDetail: SetDetail[],
  ) => void;
  match: BracketMatch | null;
  teamMatchCount: number;
  matchType: MatchType;
}

const PLAYERS_PER_TEAM = {
  TEAM_SINGLES: 1,
  TEAM_DOUBLES: 2,
} as const;

export function MatchDetailModal({
  isOpen,
  onClose,
  onSave,
  match,
  teamMatchCount,
  matchType,
}: MatchDetailModalProps) {
  const playersPerTeam =
    matchType === "TEAM_DOUBLES"
      ? PLAYERS_PER_TEAM.TEAM_DOUBLES
      : PLAYERS_PER_TEAM.TEAM_SINGLES;

  // 세트별 상태 초기화
  const createInitialSets = (): SetDetail[] => {
    // 기존 저장된 데이터가 있으면 복원
    if (match?.sets_detail && match.sets_detail.length > 0) {
      return match.sets_detail.map((s) => ({
        set_number: s.set_number,
        team1_players: [...s.team1_players],
        team2_players: [...s.team2_players],
        team1_score: s.team1_score,
        team2_score: s.team2_score,
      }));
    }

    return Array.from({ length: teamMatchCount }, (_, i) => ({
      set_number: i + 1,
      team1_players: Array(playersPerTeam).fill(""),
      team2_players: Array(playersPerTeam).fill(""),
      team1_score: null,
      team2_score: null,
    }));
  };

  const [sets, setSets] = useState<SetDetail[]>(createInitialSets);

  // match 변경 시 초기화
  useEffect(() => {
    if (isOpen && match) {
      setSets(createInitialSets());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, match?.id]);

  // 팀별 선수 목록 (대표 선수 + 팀원)
  const team1Players = useMemo(() => {
    if (!match?.team1) return [];
    const players = [match.team1.player_name];
    if (match.team1.team_members) {
      players.push(...match.team1.team_members.map((m) => m.name));
    }
    return players;
  }, [match?.team1]);

  const team2Players = useMemo(() => {
    if (!match?.team2) return [];
    const players = [match.team2.player_name];
    if (match.team2.team_members) {
      players.push(...match.team2.team_members.map((m) => m.name));
    }
    return players;
  }, [match?.team2]);

  // Best-of-N 로직
  const winsNeeded = Math.ceil(teamMatchCount / 2);

  const { team1Wins, team2Wins, matchDecided } = useMemo(() => {
    let t1 = 0;
    let t2 = 0;
    for (const set of sets) {
      if (set.team1_score !== null && set.team2_score !== null) {
        if (set.team1_score > set.team2_score) t1++;
        else if (set.team2_score > set.team1_score) t2++;
      }
    }
    return {
      team1Wins: t1,
      team2Wins: t2,
      matchDecided: t1 >= winsNeeded || t2 >= winsNeeded,
    };
  }, [sets, winsNeeded]);

  // 세트가 비활성화 되는지 (앞선 세트까지 결정 난 경우)
  const isSetDisabled = (setIndex: number): boolean => {
    let t1 = 0;
    let t2 = 0;
    for (let i = 0; i < setIndex; i++) {
      const s = sets[i];
      if (s.team1_score !== null && s.team2_score !== null) {
        if (s.team1_score > s.team2_score) t1++;
        else if (s.team2_score > s.team1_score) t2++;
      }
    }
    return t1 >= winsNeeded || t2 >= winsNeeded;
  };

  // 복식: 이전 세트에서 사용된 선수들 (세트 간 중복 방지)
  const getUsedPlayers = (setIndex: number, team: "team1" | "team2") => {
    const used = new Set<string>();
    for (let i = 0; i < setIndex; i++) {
      const s = sets[i];
      const players = team === "team1" ? s.team1_players : s.team2_players;
      players.forEach((p) => p && used.add(p));
    }
    return used;
  };

  // 복식: 선수 선택 가능 여부 체크
  const isPlayerDisabled = (
    setIndex: number,
    team: "team1" | "team2",
    playerName: string,
  ): boolean => {
    if (matchType !== "TEAM_DOUBLES") return false;

    const currentSet = sets[setIndex];
    const currentPlayers = team === "team1" ? currentSet.team1_players : currentSet.team2_players;
    const usedInPrevious = getUsedPlayers(setIndex, team);

    // 이전 세트에서 사용된 선수
    if (usedInPrevious.has(playerName)) return true;

    // 같은 세트 내에서 이미 선택된 선수
    if (currentPlayers.filter((p) => p === playerName).length > 0) return true;

    return false;
  };

  // 세트 업데이트 헬퍼
  const updateSet = (index: number, updates: Partial<SetDetail>) => {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    );
  };

  // 선수 선택 업데이트
  const updatePlayer = (
    setIndex: number,
    team: "team1" | "team2",
    playerIndex: number,
    value: string,
  ) => {
    setSets((prev) =>
      prev.map((s, i) => {
        if (i !== setIndex) return s;
        const key = team === "team1" ? "team1_players" : "team2_players";
        const newPlayers = [...s[key]];
        newPlayers[playerIndex] = value;
        return { ...s, [key]: newPlayers };
      }),
    );
  };

  // 저장 가능 여부 검증
  const canSave = useMemo(() => {
    if (!matchDecided) return false;

    // 결정된 세트까지 모두 점수와 선수가 입력되었는지 확인
    for (const set of sets) {
      if (isSetDisabled(set.set_number - 1)) break;
      if (set.team1_score === null || set.team2_score === null) return false;
      if (set.team1_score === set.team2_score) return false;
      // 선수 선택 확인
      if (set.team1_players.some((p) => !p)) return false;
      if (set.team2_players.some((p) => !p)) return false;
    }

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, matchDecided]);

  const handleSave = () => {
    if (!match || !canSave) return;

    // 유효한 세트만 필터 (비활성화되지 않은 세트)
    const validSets = sets.filter((_, i) => !isSetDisabled(i));

    onSave(match.id, team1Wins, team2Wins, validSets);
  };

  // 단체전 모달: 팀명만 표시
  const team1Label = match?.team1?.club_name || match?.team1?.player_name || "TBD";
  const team2Label = match?.team2?.club_name || match?.team2?.player_name || "TBD";

  if (!match) return null;

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
          <span
            className={`text-sm font-bold ${team1Wins >= winsNeeded ? "text-emerald-400" : "text-(--text-primary)"}`}
          >
            {team1Wins}승
          </span>
          <span className="text-(--text-muted)">:</span>
          <span
            className={`text-sm font-bold ${team2Wins >= winsNeeded ? "text-emerald-400" : "text-(--text-primary)"}`}
          >
            {team2Wins}승
          </span>
        </div>

        {/* 세트별 입력 */}
        <div className="space-y-5">
          {sets.map((set, setIndex) => {
            const disabled = isSetDisabled(setIndex);
            return (
              <div
                key={set.set_number}
                className={`rounded-xl border p-4 transition-opacity ${
                  disabled
                    ? "opacity-40 border-(--border-color)/50 bg-(--bg-secondary)/30"
                    : "border-(--border-color) bg-(--bg-secondary)/50"
                }`}
              >
                <h4 className="text-sm font-semibold text-(--text-primary) mb-3">
                  세트 {set.set_number}
                  {disabled && (
                    <span className="ml-2 text-xs text-(--text-muted) font-normal">
                      (승부 결정)
                    </span>
                  )}
                </h4>

                {/* 선수 선택 + 점수 그리드 */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                  {/* 팀1 */}
                  <div className="space-y-2">
                    <label className="text-xs text-(--text-muted) block">
                      {team1Label}
                    </label>
                    {Array.from({ length: playersPerTeam }, (_, pIdx) => (
                      <select
                        key={`t1-${pIdx}`}
                        value={set.team1_players[pIdx] || ""}
                        onChange={(e) =>
                          updatePlayer(
                            setIndex,
                            "team1",
                            pIdx,
                            e.target.value,
                          )
                        }
                        disabled={disabled}
                        className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-sm disabled:opacity-50"
                      >
                        <option value="">선수 선택</option>
                        {team1Players.map((name) => (
                          <option
                            key={name}
                            value={name}
                            disabled={isPlayerDisabled(setIndex, "team1", name)}
                          >
                            {name}
                          </option>
                        ))}
                      </select>
                    ))}
                    <input
                      type="number"
                      min="0"
                      value={set.team1_score ?? ""}
                      onChange={(e) =>
                        updateSet(setIndex, {
                          team1_score:
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value),
                        })
                      }
                      disabled={disabled}
                      placeholder="점수"
                      className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-sm disabled:opacity-50"
                    />
                  </div>

                  {/* VS 구분 */}
                  <div className="flex items-center justify-center pb-1">
                    <span className="text-(--text-muted) text-sm font-medium">
                      vs
                    </span>
                  </div>

                  {/* 팀2 */}
                  <div className="space-y-2">
                    <label className="text-xs text-(--text-muted) block">
                      {team2Label}
                    </label>
                    {Array.from({ length: playersPerTeam }, (_, pIdx) => (
                      <select
                        key={`t2-${pIdx}`}
                        value={set.team2_players[pIdx] || ""}
                        onChange={(e) =>
                          updatePlayer(
                            setIndex,
                            "team2",
                            pIdx,
                            e.target.value,
                          )
                        }
                        disabled={disabled}
                        className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-sm disabled:opacity-50"
                      >
                        <option value="">선수 선택</option>
                        {team2Players.map((name) => (
                          <option
                            key={name}
                            value={name}
                            disabled={isPlayerDisabled(setIndex, "team2", name)}
                          >
                            {name}
                          </option>
                        ))}
                      </select>
                    ))}
                    <input
                      type="number"
                      min="0"
                      value={set.team2_score ?? ""}
                      onChange={(e) =>
                        updateSet(setIndex, {
                          team2_score:
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value),
                        })
                      }
                      disabled={disabled}
                      placeholder="점수"
                      className="w-full px-2 py-1.5 rounded-lg bg-(--bg-input) border border-(--border-color) text-(--text-primary) text-center text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            );
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
          disabled={!canSave}
          className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          저장
        </button>
      </Modal.Footer>
    </Modal>
  );
}
