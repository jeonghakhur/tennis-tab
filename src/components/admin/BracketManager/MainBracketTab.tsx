"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Save, ChevronRight, MapPin } from "lucide-react";
import { MatchRow } from "./MatchRow";
import type { BracketConfig, BracketMatch } from "./types";
import { phaseLabels } from "./types";
import type { MatchPhase } from "@/lib/supabase/types";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";

interface MainBracketTabProps {
  config: BracketConfig;
  matches: BracketMatch[];
  onGenerateBracket: () => void;
  onAutoFillPhase: (phase: MatchPhase) => void;
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
  onRefresh?: () => void;
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
  onAutoFillPhase,
  onMatchResult,
  onDelete,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  onCourtBatchSave,
  onRefresh,
}: MainBracketTabProps) {

  // 코트 정보 상태
  const [courtData, setCourtData] = useState<
    Record<string, { location: string; number: string }>
  >({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // "다음 대진표 작성" 펼침 상태 (phase별)
  const [expandedNextPhase, setExpandedNextPhase] = useState<MatchPhase | null>(null);

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
  const matchesByPhase = useMemo(
    () =>
      matches.reduce(
        (acc, match) => {
          if (!acc[match.phase]) acc[match.phase] = [];
          acc[match.phase].push(match);
          return acc;
        },
        {} as Record<MatchPhase, BracketMatch[]>,
      ),
    [matches],
  );

  // 현재 대진표에 존재하는 phase 순서
  const activePhases = useMemo(
    () => PHASE_ORDER.filter((p) => matchesByPhase[p]?.length > 0),
    [matchesByPhase],
  );

  // 팀 이름 헬퍼
  const getTeamLabel = (match: BracketMatch, slot: "team1" | "team2") => {
    const team = match[slot];
    if (!team) return "TBD";
    if (team.partner_data) {
      return `${team.player_name} & ${team.partner_data.name}`;
    }
    if (isTeamMatch) {
      return team.club_name || team.player_name || "TBD";
    }
    return team.club_name
      ? `${team.club_name} ${team.player_name}`
      : team.player_name || "TBD";
  };

  // "다음 대진표 작성" 코트 일괄 저장 + 데이터 갱신
  const handleNextPhaseCourtSave = (nextPhase: MatchPhase) => {
    if (!onCourtBatchSave) return;
    const nextMatches = matchesByPhase[nextPhase] || [];
    const updates: CourtInfoUpdate[] = nextMatches
      .filter((m) => m.team1_entry_id && m.team2_entry_id)
      .map((m) => ({
        matchId: m.id,
        courtLocation: courtData[m.id]?.location?.trim() || null,
        courtNumber: courtData[m.id]?.number?.trim() || null,
      }));
    if (updates.length > 0) {
      onCourtBatchSave(updates);
    }
    setExpandedNextPhase(null);
    // 데이터 갱신 (승자 전파된 다음 라운드 데이터 리페치)
    if (onRefresh) {
      onRefresh();
    }
  };

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
          <p className="text-sm mt-1">
            조 편성 완료 후 본선 대진표를 생성하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {PHASE_ORDER.map((phase, phaseIdx) => {
            const phaseMatches = matchesByPhase[phase];
            if (!phaseMatches || phaseMatches.length === 0) return null;

            const phaseMatchIds = phaseMatches.map((m) => m.id);
            const hasDirty = phaseMatchIds.some((id) => dirtyIds.has(id));

            // 해당 강에 양팀 배정된 SCHEDULED 경기 존재 여부
            const hasScheduledWithTeams = phaseMatches.some(
              (m) =>
                m.status === "SCHEDULED" &&
                m.team1_entry_id &&
                m.team2_entry_id,
            );

            // 이 라운드의 모든 경기가 완료되었는지 (BYE 포함)
            const allCompleted = phaseMatches.every(
              (m) => m.status === "COMPLETED" || m.status === "BYE",
            );

            // 다음 라운드 찾기
            const currentPhaseIndex = activePhases.indexOf(phase);
            const nextPhase =
              currentPhaseIndex >= 0 && currentPhaseIndex < activePhases.length - 1
                ? activePhases[currentPhaseIndex + 1]
                : null;

            // 다음 라운드에 양팀 배정된 미완료 경기가 있는지
            const nextPhaseMatches = nextPhase ? matchesByPhase[nextPhase] || [] : [];
            const nextPhaseHasReadyMatches = nextPhaseMatches.some(
              (m) =>
                m.status === "SCHEDULED" &&
                m.team1_entry_id &&
                m.team2_entry_id,
            );

            // "다음 대진표 작성" 버튼 표시 조건:
            // 현재 라운드 모두 완료 + 다음 라운드가 존재 + 다음 라운드에 배정된 경기가 있음
            const showNextPhaseButton = allCompleted && nextPhase && nextPhaseHasReadyMatches;

            const isNextPhaseExpanded = expandedNextPhase === nextPhase;

            return (
              <div key={phase}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-(--text-primary) flex items-center gap-2">
                    {phaseLabels[phase]}
                    <span className="text-sm font-normal text-(--text-muted)">
                      ({phaseMatches.length}경기)
                    </span>
                    {allCompleted && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                        완료
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-2">
                    {hasScheduledWithTeams &&
                      process.env.NODE_ENV === "development" && (
                        <button
                          onClick={() => onAutoFillPhase(phase)}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 border-dashed transition-colors text-xs font-medium"
                        >
                          자동 입력 (DEV)
                        </button>
                      )}
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

                {/* 다음 대진표 작성 버튼 */}
                {showNextPhaseButton && nextPhase && (
                  <div className="mt-4">
                    {!isNextPhaseExpanded ? (
                      <button
                        onClick={() => setExpandedNextPhase(nextPhase)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-(--accent-color)/10 text-(--accent-color) hover:bg-(--accent-color)/20 border-2 border-dashed border-(--accent-color)/40 transition-all font-medium"
                      >
                        <ChevronRight className="w-5 h-5" />
                        다음 대진표 작성 ({phaseLabels[nextPhase]})
                      </button>
                    ) : (
                      <div className="rounded-xl border-2 border-(--accent-color)/40 bg-(--accent-color)/5 overflow-hidden">
                        {/* 헤더 */}
                        <div className="px-4 py-3 bg-(--accent-color)/10 flex items-center justify-between">
                          <h4 className="font-semibold text-(--accent-color) flex items-center gap-2">
                            <ChevronRight className="w-5 h-5" />
                            {phaseLabels[nextPhase]} 코트 배정
                            <span className="text-sm font-normal opacity-70">
                              ({nextPhaseMatches.filter((m) => m.team1_entry_id && m.team2_entry_id).length}경기)
                            </span>
                          </h4>
                          <button
                            onClick={() => setExpandedNextPhase(null)}
                            className="text-sm text-(--text-muted) hover:text-(--text-primary) transition-colors"
                          >
                            접기
                          </button>
                        </div>

                        {/* 다음 라운드 경기 목록 + 코트 입력 */}
                        <div className="p-4 space-y-3">
                          {nextPhaseMatches
                            .filter((m) => m.team1_entry_id && m.team2_entry_id)
                            .map((match) => (
                              <div
                                key={match.id}
                                className="flex flex-col gap-2 p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)"
                              >
                                {/* 대진 정보 */}
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-(--text-muted) w-8">
                                    #{match.match_number}
                                  </span>
                                  <span className="flex-1 text-right text-sm font-medium text-(--text-primary)">
                                    {getTeamLabel(match, "team1")}
                                  </span>
                                  <span className="text-(--text-muted) text-sm">vs</span>
                                  <span className="flex-1 text-left text-sm font-medium text-(--text-primary)">
                                    {getTeamLabel(match, "team2")}
                                  </span>
                                </div>

                                {/* 코트 배정 입력 */}
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-(--court-info) shrink-0" />
                                  <input
                                    type="text"
                                    value={courtData[match.id]?.location ?? ""}
                                    onChange={(e) =>
                                      handleCourtChange(match.id, "location", e.target.value)
                                    }
                                    placeholder="장소 (예: A구장)"
                                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted)"
                                  />
                                  <input
                                    type="text"
                                    value={courtData[match.id]?.number ?? ""}
                                    onChange={(e) =>
                                      handleCourtChange(match.id, "number", e.target.value)
                                    }
                                    placeholder="코트 번호"
                                    className="w-24 px-2.5 py-1.5 text-sm rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted)"
                                  />
                                </div>
                              </div>
                            ))}

                          {/* 저장 버튼 */}
                          <button
                            onClick={() => handleNextPhaseCourtSave(nextPhase)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-(--accent-color) text-white font-medium hover:opacity-90 transition-opacity"
                          >
                            <Save className="w-5 h-5" />
                            {phaseLabels[nextPhase]} 코트 배정 저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
