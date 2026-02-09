"use client";

import { Trophy } from "lucide-react";
import { MatchRow } from "./MatchRow";
import type { BracketConfig, BracketMatch } from "./types";
import { phaseLabels } from "./types";
import type { MatchPhase } from "@/lib/supabase/types";

interface MainBracketTabProps {
  config: BracketConfig;
  matches: BracketMatch[];
  onGenerateBracket: () => void;
  onMatchResult: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onDelete: () => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
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
  onMatchResult,
  onDelete,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
}: MainBracketTabProps) {
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
          {config.has_preliminaries && (
            <p className="text-sm mt-1">
              예선전 완료 후 본선 대진표를 생성하세요.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {PHASE_ORDER.map((phase) => {
            const phaseMatches = matchesByPhase[phase];
            if (!phaseMatches || phaseMatches.length === 0) return null;

            return (
              <div key={phase}>
                <h4 className="font-semibold text-(--text-primary) mb-3 flex items-center gap-2">
                  {phaseLabels[phase]}
                  <span className="text-sm font-normal text-(--text-muted)">
                    ({phaseMatches.length}경기)
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {phaseMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      onResult={onMatchResult}
                      onTieWarning={onTieWarning}
                      isTeamMatch={isTeamMatch}
                      onOpenDetail={onOpenDetail}
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
