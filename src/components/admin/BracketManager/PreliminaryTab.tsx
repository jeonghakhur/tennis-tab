"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Save } from "lucide-react";
import { MatchRow } from "./MatchRow";
import type { PreliminaryGroup, BracketMatch } from "./types";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";

interface PreliminaryTabProps {
  groups: PreliminaryGroup[];
  matches: BracketMatch[];
  onMatchResult: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onAutoFill: () => void;
  onDelete: () => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
  onCourtBatchSave?: (updates: CourtInfoUpdate[]) => void;
}

export function PreliminaryTab({
  groups,
  matches,
  onMatchResult,
  onAutoFill,
  onDelete,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  onCourtBatchSave,
}: PreliminaryTabProps) {
  const hasScheduledMatches = matches.some((m) => m.status === "SCHEDULED");

  // 코트 정보 상태: matchId → { location, number }
  const [courtData, setCourtData] = useState<
    Record<string, { location: string; number: string }>
  >({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // matches가 갱신되면 (서버에서 새로 로드) courtData 동기화 + dirty 초기화
  useEffect(() => {
    const data: Record<string, { location: string; number: string }> = {};
    for (const m of matches) {
      data[m.id] = {
        location: m.court_location || "",
        number: m.court_number || "",
      };
    }
    setCourtData(data);
    setDirtyIds(new Set());
  }, [matches]);

  const handleCourtChange = useCallback(
    (matchId: string, field: "location" | "number", value: string) => {
      setCourtData((prev) => ({
        ...prev,
        [matchId]: { ...prev[matchId], [field]: value },
      }));
      setDirtyIds((prev) => new Set(prev).add(matchId));
    },
    [],
  );

  // 특정 조의 변경된 코트 정보만 수집하여 저장
  const handleGroupCourtSave = (groupMatchIds: string[]) => {
    if (!onCourtBatchSave) return;
    const updates: CourtInfoUpdate[] = groupMatchIds
      .filter((id) => dirtyIds.has(id))
      .map((id) => ({
        matchId: id,
        courtLocation: courtData[id]?.location?.trim() || null,
        courtNumber: courtData[id]?.number?.trim() || null,
      }));
    if (updates.length > 0) {
      onCourtBatchSave(updates);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-(--text-primary)">
          예선 경기
        </h3>
        <div className="flex gap-2">
          {hasScheduledMatches && process.env.NODE_ENV === "development" && (
            <button
              onClick={onAutoFill}
              className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 border-dashed transition-colors text-sm font-medium"
            >
              자동 결과 입력 (DEV)
            </button>
          )}
          {matches.length > 0 && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors text-sm font-medium"
            >
              예선 경기 삭제
            </button>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8 text-(--text-muted)">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>예선 경기가 없습니다. 조 편성 후 경기를 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupMatches = matches.filter((m) => m.group_id === group.id);
            const groupMatchIds = groupMatches.map((m) => m.id);
            const hasDirty = groupMatchIds.some((id) => dirtyIds.has(id));
            const standings = group.group_teams?.slice().sort((a, b) => {
              if (a.final_rank && b.final_rank)
                return a.final_rank - b.final_rank;
              return b.wins - b.losses - (a.wins - a.losses);
            });

            return (
              <div key={group.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-semibold text-(--text-primary)">
                    {group.name}조
                  </h4>
                  {onCourtBatchSave && hasDirty && (
                    <button
                      onClick={() => handleGroupCourtSave(groupMatchIds)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--court-info)/10 text-(--court-info) hover:bg-(--court-info)/20 border border-(--court-info)/30 transition-colors text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      코트 저장
                    </button>
                  )}
                </div>

                {/* 순위표 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-(--text-muted) border-b border-(--border-color)">
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
                        <tr
                          key={team.id}
                          className="border-b border-(--border-color)"
                        >
                          <td className="py-2 px-3">
                            <span
                              className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                                index < 2
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-(--bg-secondary) text-(--text-muted)"
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-(--text-primary)">
                            {isTeamMatch ? (
                              <p className="text-sm font-medium">
                                {team.entry?.club_name || team.entry?.player_name}
                              </p>
                            ) : (
                              <>
                                {team.entry?.club_name && (
                                  <p className="text-sm font-medium">
                                    {team.entry.club_name}
                                  </p>
                                )}
                                <p
                                  className={
                                    team.entry?.club_name
                                      ? "text-xs text-(--text-muted)"
                                      : "text-sm"
                                  }
                                >
                                  {team.entry?.player_name}
                                </p>
                              </>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-(--text-primary)">
                            {team.wins}
                          </td>
                          <td className="py-2 px-3 text-center text-(--text-primary)">
                            {team.losses}
                          </td>
                          <td className="py-2 px-3 text-center text-(--text-primary)">
                            {team.points_for}
                          </td>
                          <td className="py-2 px-3 text-center text-(--text-primary)">
                            {team.points_against}
                          </td>
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
                      onTieWarning={onTieWarning}
                      isTeamMatch={isTeamMatch}
                      onOpenDetail={onOpenDetail}
                      courtLocation={courtData[match.id]?.location}
                      courtNumber={courtData[match.id]?.number}
                      onCourtChange={onCourtBatchSave ? handleCourtChange : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
