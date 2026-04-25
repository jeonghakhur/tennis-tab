"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Save, AlertTriangle, ChevronRight } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { GroupsTab } from "./GroupsTab";
import type { BracketConfig, BracketMatch, PreliminaryGroup } from "./types";
import { phaseLabels } from "./types";
import type { MatchPhase } from "@/lib/supabase/types";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";

interface MainBracketTabProps {
  config: BracketConfig;
  matches: BracketMatch[];
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
  // 시드 배치 props
  seedingGroups?: PreliminaryGroup[];
  allPrelimsDone?: boolean;
  nextPhaseLabel?: string;
  onGenerateBracketWithSeeds?: (seedOrder: (string | null)[]) => void;
  /** 라운드별 경기 진행 토글 */
  onToggleRoundActive?: (round: number) => void;
  /**
   * 외부에서 조편성 탭 강제 활성화 트리거 (Date.now() 등 증가하는 값).
   * 값이 변경될 때마다 시드 탭으로 이동.
   */
  seedingNavRequest?: number;
}

// round_number → 라운드 라벨 (8강, 준결승, 결승 등)
function getRoundLabel(roundNum: number, bracketSize: number | null): string {
  if (!bracketSize) return `${roundNum}라운드`;
  const totalRounds = Math.log2(bracketSize);
  const roundsFromFinal = totalRounds - roundNum + 1;
  switch (roundsFromFinal) {
    case 1: return "결승";
    case 2: return "준결승";
    case 3: return "8강";
    case 4: return "16강";
    case 5: return "32강";
    case 6: return "64강";
    default: return `${roundNum}라운드`;
  }
}

// PHASE_ORDER는 한 라운드 탭 내에서 위상 정렬용
const PHASE_ORDER: MatchPhase[] = [
  "ROUND_128", "ROUND_64", "ROUND_32", "ROUND_16",
  "QUARTER", "SEMI", "THIRD_PLACE", "FINAL",
];

export function MainBracketTab({
  config,
  matches,
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
  onToggleRoundActive,
  seedingNavRequest,
}: MainBracketTabProps) {

  // 코트 정보 상태
  const [courtData, setCourtData] = useState<
    Record<string, { location: string; number: string }>
  >({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // matches 갱신 시 코트 데이터 동기화
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

  // 라운드별 경기 그룹화 (PRELIMINARY 제외, THIRD_PLACE 포함)
  const roundsData = useMemo(() => {
    const map = new Map<number, BracketMatch[]>();
    for (const m of matches.filter((m) => m.phase !== "PRELIMINARY")) {
      const r = m.round_number ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [matches]);

  const maxRound = roundsData.length > 0 ? roundsData[roundsData.length - 1][0] : 0;
  const hasFinal = matches.some((m) => m.phase === "FINAL");

  // 결승 라운드 여부: 조편성 없이 바로 생성
  const isFinalGeneration = nextPhaseLabel === "결승";

  // 조편성 탭 노출 조건: seedingGroups 있고 결승 미생성 + 콜백 있음 + 결승 라운드 아님
  const showSeedingTab =
    !!seedingGroups &&
    seedingGroups.length > 0 &&
    !hasFinal &&
    !!onGenerateBracketWithSeeds &&
    !isFinalGeneration;

  // 결승 바로 생성: 준결승 승자 2명을 그대로 seedOrder로 사용
  const handleGenerateFinalDirect = () => {
    if (!seedingGroups || !onGenerateBracketWithSeeds) return;
    const seedOrder = seedingGroups.flatMap((g) => {
      const teams = g.group_teams || [];
      return [teams[0]?.entry_id ?? null, teams[1]?.entry_id ?? null];
    });
    onGenerateBracketWithSeeds(seedOrder);
  };

  // 현재 선택 탭: 'round-N' | 'seeding'
  const defaultTab =
    maxRound > 0 ? `round-${maxRound}` : showSeedingTab ? "seeding" : "";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // 라운드 추가 시 최신 라운드 탭 자동 이동
  useEffect(() => {
    if (maxRound > 0) {
      setActiveTab(`round-${maxRound}`);
    } else if (showSeedingTab) {
      setActiveTab("seeding");
    }
  }, [maxRound, showSeedingTab]);

  // 외부 트리거: 조편성 탭 강제 활성화 (예선 탭/이전 라운드의 "조편성 진행" 버튼)
  useEffect(() => {
    if (seedingNavRequest && showSeedingTab) {
      setActiveTab("seeding");
    }
  }, [seedingNavRequest, showSeedingTab]);

  // 선택된 라운드 번호
  const selectedRoundNum = activeTab.startsWith("round-")
    ? parseInt(activeTab.replace("round-", ""), 10)
    : null;

  // 선택된 라운드 경기 목록 (PHASE_ORDER 정렬)
  const selectedRoundMatches = useMemo(() => {
    if (selectedRoundNum === null) return [];
    const roundMatches = roundsData.find(([r]) => r === selectedRoundNum)?.[1] ?? [];
    return [...roundMatches].sort(
      (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
    );
  }, [selectedRoundNum, roundsData]);

  // 선택된 라운드 내 phase별 그룹 (같은 라운드에 FINAL+THIRD_PLACE 공존 가능)
  const selectedMatchesByPhase = useMemo(() => {
    return selectedRoundMatches.reduce(
      (acc, m) => {
        if (!acc[m.phase]) acc[m.phase] = [];
        acc[m.phase].push(m);
        return acc;
      },
      {} as Record<MatchPhase, BracketMatch[]>,
    );
  }, [selectedRoundMatches]);

  // 최신 라운드 라벨 (삭제 버튼용)
  const latestPhase = useMemo(() => {
    const nonThirdPlace = matches.filter((m) => m.phase !== "THIRD_PLACE" && m.phase !== "PRELIMINARY");
    if (nonThirdPlace.length === 0) return null;
    const max = Math.max(...nonThirdPlace.map((m) => m.round_number ?? 0));
    return nonThirdPlace.find((m) => m.round_number === max)?.phase ?? null;
  }, [matches]);

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
    if (updates.length > 0) onCourtBatchSave(updates);
  };

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
          {onDelete && matches.length > 0 && (
            <button onClick={onDelete} className="btn-outline-danger">
              본선 대진표 삭제
            </button>
          )}
        </div>
      </div>

      {/* 라운드 탭 네비게이션 */}
      {(roundsData.length > 0 || showSeedingTab) && (
        <div className="flex gap-0 border-b border-(--border-color) overflow-x-auto">
          {roundsData.map(([roundNum, roundMatches]) => {
            const tabId = `round-${roundNum}`;
            const label = getRoundLabel(roundNum, config.bracket_size);
            const isComplete = roundMatches
              .filter((m) => m.phase !== "THIRD_PLACE")
              .every((m) => m.status === "COMPLETED" || m.status === "BYE");
            const isTabActive = activeTab === tabId;
            const isRoundInProgress =
              config.active_phase === "MAIN" && config.active_round === roundNum;
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isTabActive
                    ? "border-(--accent-color) text-(--accent-color)"
                    : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
                }`}
              >
                {label}
                {isRoundInProgress && (
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-success) animate-pulse flex-shrink-0" />
                )}
                {!isRoundInProgress && isComplete && (
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-success) flex-shrink-0" />
                )}
              </button>
            );
          })}

          {/* 조편성 탭 (다음 라운드 준비) */}
          {showSeedingTab && (
            <button
              onClick={() => setActiveTab("seeding")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === "seeding"
                  ? "border-(--accent-color) text-(--accent-color)"
                  : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
              }`}
            >
              {nextPhaseLabel || "다음 라운드"} 조편성
              {!allPrelimsDone && maxRound > 0 && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </button>
          )}
        </div>
      )}

      {/* 조편성 탭 컨텐츠 */}
      {activeTab === "seeding" && showSeedingTab && (
        <div className="space-y-4">
          {/* 현재 라운드 미완료 경고 */}
          {!allPrelimsDone && maxRound > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-(--color-warning-subtle) border border-(--color-warning-border) text-(--color-warning) text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              현재 라운드의 모든 경기가 완료되어야 다음 라운드를 생성할 수 있습니다.
            </div>
          )}
          <p className="text-sm text-(--text-muted)">
            드래그하여 시드 순서를 조정하세요. 같은 칸 안의 팀끼리 대진합니다.
          </p>
          <GroupsTab
            groups={seedingGroups}
            hasPreliminary={false}
            title={`${nextPhaseLabel || "본선"} 시드 배정`}
            generateButtonLabel={
              maxRound === 0
                ? "1라운드 생성"
                : `${nextPhaseLabel || "다음 라운드"} 생성`
            }
            onGenerateMainBracket={
              allPrelimsDone ? onGenerateBracketWithSeeds : undefined
            }
            onError={() => {}}
            isTeamMatch={isTeamMatch}
          />
        </div>
      )}

      {/* 결승 바로 생성 (조편성 없이) */}
      {isFinalGeneration && !hasFinal && seedingGroups && seedingGroups.length > 0 && onGenerateBracketWithSeeds && (
        <div className="rounded-xl border border-(--border-color) bg-(--bg-card) p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-(--accent-color)" />
            <h3 className="font-semibold text-(--text-primary)">결승 생성</h3>
          </div>
          {!allPrelimsDone ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-(--color-warning-subtle) border border-(--color-warning-border) text-(--color-warning) text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              준결승 경기가 모두 완료되어야 결승을 생성할 수 있습니다.
            </div>
          ) : (
            <>
              <p className="text-sm text-(--text-muted)">
                준결승 승자가 자동으로 배정됩니다.
              </p>
              <div className="flex gap-3">
                {seedingGroups.flatMap((g) => g.group_teams || []).map((team) => (
                  <div key={team.id} className="flex-1 px-3 py-2 rounded-lg bg-(--bg-secondary) text-sm">
                    <p className="font-medium text-(--text-primary) truncate">
                      {team.entry?.club_name || team.entry?.player_name}
                      {team.entry?.team_order && (
                        <span className="ml-1 text-xs text-(--text-muted)">
                          ({team.entry.team_order}팀)
                        </span>
                      )}
                    </p>
                    {team.entry?.club_name && (
                      <p className="text-xs text-(--text-muted) truncate">{team.entry.player_name}</p>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleGenerateFinalDirect}
                className="btn-primary w-full"
              >
                <span className="relative z-10">결승 생성</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* 라운드 탭 컨텐츠 */}
      {activeTab.startsWith("round-") && selectedRoundNum !== null && (
        <div className="space-y-6">
          {/* 라운드별 경기 진행 토글 */}
          {onToggleRoundActive && (
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-(--text-muted)">
                {getRoundLabel(selectedRoundNum, config.bracket_size)} 참가자 점수 입력
              </span>
              {(() => {
                const isRoundInProgress =
                  config.active_phase === "MAIN" &&
                  config.active_round === selectedRoundNum;
                return (
                  <button
                    onClick={() => onToggleRoundActive(selectedRoundNum)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isRoundInProgress
                        ? "bg-(--color-success-subtle) text-(--color-success) hover:bg-(--color-success-subtle)/80"
                        : "bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-card-hover) border border-(--border-color)"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isRoundInProgress ? "bg-(--color-success) animate-pulse" : "bg-(--text-muted)"
                      }`}
                    />
                    {isRoundInProgress ? "진행중" : "경기 진행"}
                  </button>
                );
              })()}
            </div>
          )}
          {PHASE_ORDER.map((phase) => {
            const phaseMatches = selectedMatchesByPhase[phase];
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
                    {onAutoFillPhase &&
                      hasScheduledWithTeams &&
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
              </div>
            );
          })}

          {/* 최신 라운드 하단: 다음 라운드 조편성 진행 + 라운드 삭제 */}
          {selectedRoundNum === maxRound && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-(--border-color)">
              {/* 다음 라운드 조편성 진행 (조편성 탭이 노출 가능한 상태일 때만) */}
              {showSeedingTab ? (
                <button
                  onClick={() => setActiveTab("seeding")}
                  disabled={!allPrelimsDone}
                  title={
                    allPrelimsDone
                      ? `${nextPhaseLabel || "다음 라운드"} 조편성 화면으로 이동합니다`
                      : "현재 라운드 경기를 모두 입력해야 합니다"
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    allPrelimsDone
                      ? "bg-(--accent-color) text-(--bg-primary) hover:opacity-90 shadow-sm"
                      : "bg-(--bg-secondary) text-(--text-muted) border border-(--border-color) cursor-not-allowed opacity-60"
                  }`}
                >
                  {nextPhaseLabel || "다음 라운드"} 조편성 진행
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <span />
              )}
              {onDeleteLatestRound && latestPhase && (
                <button
                  onClick={onDeleteLatestRound}
                  className="btn-outline-warning btn-sm"
                >
                  {getRoundLabel(selectedRoundNum, config.bracket_size)} 삭제
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 빈 상태: 매치도 없고 조편성도 없음 */}
      {matches.length === 0 && !showSeedingTab && (
        <div className="text-center py-8 text-(--text-muted)">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>본선 대진표가 없습니다.</p>
          <p className="text-sm mt-1">
            조편성 탭에서 조편성을 완료하면 시드 배치 화면이 나타납니다.
          </p>
        </div>
      )}
    </div>
  );
}
