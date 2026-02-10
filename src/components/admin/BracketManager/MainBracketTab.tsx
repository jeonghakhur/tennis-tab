"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Save } from "lucide-react";
import { MatchRow } from "./MatchRow";
import type { BracketConfig, BracketMatch } from "./types";
import { phaseLabels } from "./types";
import type { MatchPhase } from "@/lib/supabase/types";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";

interface MainBracketTabProps {
  config: BracketConfig;
  matches: BracketMatch[];
  onGenerateBracket: () => void;
  onAutoFill: () => void;
  onMatchResult: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onDelete: () => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
  onCourtBatchSave?: (updates: CourtInfoUpdate[]) => void;
}

const PHASE_ORDER: MatchPhase[] = [
  "ROUND_128",
  "ROUND_64",
  "ROUND_32",
  "ROUND_16",
  "QUARTER",
  "SEMI",
  "THIRD_PLACE",
  "FINAL",
];

export function MainBracketTab({
  config,
  matches,
  onGenerateBracket,
  onAutoFill,
  onMatchResult,
  onDelete,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  onCourtBatchSave,
}: MainBracketTabProps) {
  const hasScheduledMatches = matches.some((m) => m.status === "SCHEDULED");

  // 코트 정보 상태
  const [courtData, setCourtData] = useState<
    Record<string, { location: string; number: string }>
  >({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // matches 갱신 시 동기화
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

  // 특정 강의 변경된 코트 정보만 수집하여 저장
  const handlePhaseCourtSave = (phaseMatchIds: string[]) => {
    if (!onCourtBatchSave) return;
    const updates: CourtInfoUpdate[] = phaseMatchIds
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

  // 라운드별로 경기 그룹화
  const matchesByPhase = matches.reduce(
    (acc, match) => {
      if (!acc[match.phase]) acc[match.phase] = [];
      acc[match.phase].push(match);
      return acc;
    },
    {} as Record<MatchPhase, BracketMatch[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-(--text-primary)">
          본선 대진표
          {config.bracket_size && (
            <span className="ml-2 text-sm font-normal text-(--text-muted)">
              ({config.bracket_size}강)
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {(config.status === "DRAFT" || config.status === "PRELIMINARY") && (
            <button onClick={onGenerateBracket} className="btn-primary btn-sm">
              <span className="relative z-10">본선 대진표 생성</span>
            </button>
          )}
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
              본선 대진표 삭제
            </button>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8 text-(--text-muted)">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>본선 대진표가 없습니다.</p>
          <p className="text-sm mt-1">
            조 편성 완료 후 본선 대진표를 생성하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {PHASE_ORDER.map((phase) => {
            const phaseMatches = matchesByPhase[phase];
            if (!phaseMatches || phaseMatches.length === 0) return null;

            const phaseMatchIds = phaseMatches.map((m) => m.id);
            const hasDirty = phaseMatchIds.some((id) => dirtyIds.has(id));

            return (
              <div key={phase}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-(--text-primary) flex items-center gap-2">
                    {phaseLabels[phase]}
                    <span className="text-sm font-normal text-(--text-muted)">
                      ({phaseMatches.length}경기)
                    </span>
                  </h4>
                  {onCourtBatchSave && hasDirty && (
                    <button
                      onClick={() => handlePhaseCourtSave(phaseMatchIds)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--court-info)/10 text-(--court-info) hover:bg-(--court-info)/20 border border-(--court-info)/30 transition-colors text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      코트 저장
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {phaseMatches.map((match) => (
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
