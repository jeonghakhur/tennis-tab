"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Save, AlertTriangle, RefreshCw } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { GroupsTab } from "./GroupsTab";
import type { BracketConfig, BracketMatch, PreliminaryGroup } from "./types";
import { phaseLabels } from "./types";
import type { MatchPhase } from "@/lib/supabase/types";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";

interface MainBracketTabProps {
  config: BracketConfig;
  matches: BracketMatch[];
  onGenerateBracket?: () => void;
  onAutoFillPhase?: (phase: MatchPhase) => void;
  onMatchResult?: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onDelete?: () => void;
  onDeleteLatestRound?: () => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
  onCourtBatchSave?: (updates: CourtInfoUpdate[]) => void;
  // 시드 배치 미리보기 props
  seedingGroups?: PreliminaryGroup[];
  allPrelimsDone?: boolean;
  nextPhaseLabel?: string;
  onGenerateBracketWithSeeds?: (seedOrder: (string | null)[]) => void;
  onRefreshNextRound?: () => void;
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
  onDeleteLatestRound,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  onCourtBatchSave,
  seedingGroups,
  allPrelimsDone,
  nextPhaseLabel,
  onGenerateBracketWithSeeds,
  onRefreshNextRound,
}: MainBracketTabProps) {

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

  // 결승 존재 여부
  const hasFinal = matches.some(m => m.phase === "FINAL");

  // 최신 라운드의 phase (THIRD_PLACE 제외) — 삭제 버튼 표시용
  const latestPhase = useMemo(() => {
    const nonThirdPlace = matches.filter(m => m.phase !== "THIRD_PLACE");
    if (nonThirdPlace.length === 0) return null;
    const maxRound = Math.max(...nonThirdPlace.map(m => m.round_number ?? 0));
    const match = nonThirdPlace.find(m => m.round_number === maxRound);
    return match?.phase ?? null;
  }, [matches]);

  // 최신 라운드 모든 경기 완료 여부 (BYE·빈 매치 포함, THIRD_PLACE 제외)
  const latestRoundAllCompleted = useMemo(() => {
    const nonThirdPlace = matches.filter(m => m.phase !== "THIRD_PLACE");
    if (nonThirdPlace.length === 0) return false;
    const maxRound = Math.max(...nonThirdPlace.map(m => m.round_number ?? 0));
    const latestMatches = nonThirdPlace.filter(m => m.round_number === maxRound);
    // 빈 매치(양팀 미배정)도 "완료"로 간주
    return latestMatches.every(
      m => m.status === "COMPLETED" || m.status === "BYE" ||
        (!m.team1_entry_id && !m.team2_entry_id),
    );
  }, [matches]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
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
          {/* 시드 배치 모드에서는 기존 생성 버튼 숨김 */}
          {!seedingGroups && onGenerateBracket && (config.status === "DRAFT" || config.status === "PRELIMINARY") && (
            <button onClick={onGenerateBracket} className="btn-primary btn-sm">
              <span className="relative z-10">본선 대진표 생성</span>
            </button>
          )}
          {/* 전체 본선 삭제 */}
          {onDelete && matches.length > 0 && (
            <button
              onClick={onDelete}
              className="btn-outline-danger"
            >
              본선 대진표 삭제
            </button>
          )}
        </div>
      </div>

      {/* 매치 목록 (매치가 있으면 항상 표시) */}
      {matches.length > 0 && (
        <div className="space-y-6">
          {PHASE_ORDER.map((phase) => {
            const phaseMatches = matchesByPhase[phase];
            if (!phaseMatches || phaseMatches.length === 0) return null;

            const phaseMatchIds = phaseMatches.map((m) => m.id);
            const hasDirty = phaseMatchIds.some((id) => dirtyIds.has(id));

            const hasScheduledWithTeams = phaseMatches.some(
              (m) =>
                m.status === "SCHEDULED" &&
                m.team1_entry_id &&
                m.team2_entry_id,
            );

            const allCompleted = phaseMatches.every(
              (m) => m.status === "COMPLETED" || m.status === "BYE",
            );

            return (
              <div key={phase}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-(--text-primary) flex items-center gap-2">
                    {phaseLabels[phase]}
                    <span className="text-sm font-normal text-(--text-muted)">
                      ({phaseMatches.length}경기)
                    </span>
                    {allCompleted && (
                      <span className="px-2 py-0.5 rounded-full bg-(--color-success-subtle) text-(--color-success) text-xs font-medium">
                        완료
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-2">
                    {onAutoFillPhase && hasScheduledWithTeams &&
                      process.env.NODE_ENV === "development" && (
                        <button
                          onClick={() => onAutoFillPhase(phase)}
                          className="btn-outline-purple btn-dashed btn-sm"
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
                {/* 최신 라운드 하단에 삭제 버튼 */}
                {phase === latestPhase && onDeleteLatestRound && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={onDeleteLatestRound}
                      className="btn-outline-warning btn-sm"
                    >
                      {phaseLabels[phase]} 삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 다음 라운드 시드 배치 (시드 데이터가 있고 결승이 아직 없을 때) */}
      {seedingGroups && seedingGroups.length > 0 && !hasFinal && (
        <div className="space-y-4 mt-6 pt-6 border-t border-(--border-color)">
          {!allPrelimsDone && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-(--color-warning-subtle) border border-(--color-warning-border) text-(--color-warning) text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {matches.length === 0
                ? "예선이 아직 완료되지 않았습니다. 모든 예선 경기가 끝나야 본선 대진표를 생성할 수 있습니다."
                : "현재 라운드의 모든 경기가 완료되어야 다음 라운드를 생성할 수 있습니다."}
            </div>
          )}
          <p className="text-sm text-(--text-muted)">
            드래그하여 시드 순서를 조정하세요. 같은 조 안의 팀끼리 대진합니다.
          </p>
          <GroupsTab
            groups={seedingGroups}
            hasPreliminary={false}
            title={`${nextPhaseLabel || "본선"} 시드 배정`}
            generateButtonLabel={
              matches.length === 0
                ? "본선 대진표 생성"
                : `${nextPhaseLabel || "본선"} 대진표 생성`
            }
            onGenerateMainBracket={allPrelimsDone ? onGenerateBracketWithSeeds : undefined}
            onError={() => {}}
          />
        </div>
      )}

      {/* 현재 라운드 완료 감지 안내 (매치는 있지만 시드 데이터도 없고 결승도 없을 때) */}
      {matches.length > 0 && !seedingGroups && !hasFinal && (
        <div className="mt-4 px-4 py-4 rounded-lg bg-(--bg-secondary) border border-(--border-color) text-center">
          {latestRoundAllCompleted ? (
            <div className="space-y-3">
              <p className="text-sm text-(--text-secondary)">
                현재 라운드의 모든 경기가 완료되었습니다.
              </p>
              {onRefreshNextRound && (
                <button
                  onClick={onRefreshNextRound}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  다음 라운드 준비
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-(--text-muted)">
              현재 라운드의 모든 경기가 완료되면 다음 라운드를 준비할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {/* 빈 상태 (매치도 시드도 없을 때) */}
      {matches.length === 0 && (!seedingGroups || seedingGroups.length === 0) && (
        <div className="text-center py-8 text-(--text-muted)">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>본선 대진표가 없습니다.</p>
          <p className="text-sm mt-1">
            조 편성 완료 후 본선 대진표를 생성하세요.
          </p>
        </div>
      )}
    </div>
  );
}
