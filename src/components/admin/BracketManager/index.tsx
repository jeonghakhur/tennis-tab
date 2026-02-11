"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Settings, Users, Play, Trophy } from "lucide-react";
import {
  AlertDialog,
  ConfirmDialog,
  Toast,
} from "@/components/common/AlertDialog";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import {
  getOrCreateBracketConfig,
  updateBracketConfig,
  autoGenerateGroups,
  getPreliminaryGroups,
  generatePreliminaryMatches,
  getPreliminaryMatches,
  generateMainBracket,
  generateNextRound,
  getMainBracketMatches,
  getAdvancingTeams,
  getNextRoundTeams,
  updateMatchResult,
  autoFillPreliminaryResults,
  autoFillMainBracketResults,
  batchUpdateMatchCourtInfo,
  deleteBracketConfig,
  deletePreliminaryGroups,
  deletePreliminaryMatches,
  deleteMainBracket,
  deleteLatestRound,
} from "@/lib/bracket/actions";
import { useMatchesRealtime, type RealtimeMatchPayload } from "@/lib/realtime/useMatchesRealtime";
import { SettingsTab } from "./SettingsTab";
import { GroupsTab } from "./GroupsTab";
import { PreliminaryTab } from "./PreliminaryTab";
import { MainBracketTab } from "./MainBracketTab";
import { MatchDetailModal } from "./MatchDetailModal";
import type { CourtInfoUpdate } from "@/lib/bracket/actions";
import type { MatchPhase } from "@/lib/supabase/types";
import type {
  BracketManagerProps,
  BracketConfig,
  PreliminaryGroup,
  BracketMatch,
  SetDetail,
} from "./types";
import { CLOSED_TOURNAMENT_STATUSES, phaseLabels } from "./types";

type TabType = "settings" | "groups" | "preliminary" | "main";

export function BracketManager({
  tournamentId,
  divisions,
  teamMatchCount,
  matchType,
  tournamentStatus,
}: BracketManagerProps) {
  // 단체전 여부 판별
  const isTeamMatch = matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES";
  // 마감된 대회 여부 — 마감 시 모든 수정 UI 비활성화
  const isClosed = CLOSED_TOURNAMENT_STATUSES.includes(tournamentStatus);
  const [selectedDivision, setSelectedDivision] = useState(
    divisions.length > 0 ? divisions[0] : null,
  );
  const [config, setConfig] = useState<BracketConfig | null>(null);
  const [groups, setGroups] = useState<PreliminaryGroup[]>([]);
  const [preliminaryMatches, setPreliminaryMatches] = useState<BracketMatch[]>(
    [],
  );
  const [mainMatches, setMainMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("불러오는 중...");
  const [activeTab, setActiveTab] = useState<TabType>("settings");

  // Dialog states
  const [showAutoGenerateConfirm, setShowAutoGenerateConfirm] = useState(false);
  const [autoGenerateConfirmMessage, setAutoGenerateConfirmMessage] =
    useState("");
  const [showGeneratePrelimConfirm, setShowGeneratePrelimConfirm] =
    useState(false);
  const [showGenerateMainConfirm, setShowGenerateMainConfirm] = useState(false);
  const [showDeleteGroupsConfirm, setShowDeleteGroupsConfirm] = useState(false);
  const [showDeletePrelimConfirm, setShowDeletePrelimConfirm] = useState(false);
  const [showDeleteMainConfirm, setShowDeleteMainConfirm] = useState(false);
  const [showDeleteLatestRoundConfirm, setShowDeleteLatestRoundConfirm] = useState(false);
  const [showDeleteBracketConfirm, setShowDeleteBracketConfirm] =
    useState(false);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "success",
  });

  // 단체전 세트별 결과 입력 모달
  const [detailMatch, setDetailMatch] = useState<BracketMatch | null>(null);

  // 본선 시드 배치 미리보기 상태
  const [seedingGroups, setSeedingGroups] = useState<PreliminaryGroup[]>([]);
  const [allPrelimsDone, setAllPrelimsDone] = useState(false);
  const [pendingSeedOrder, setPendingSeedOrder] = useState<(string | null)[]>([]);
  const [nextPhaseLabel, setNextPhaseLabel] = useState("");
  // React 18 batching 안전성: ref로 시드 순서를 동기적으로 참조
  const pendingSeedOrderRef = useRef<(string | null)[]>([]);

  const showError = useCallback((title: string, message: string) => {
    setAlertDialog({ isOpen: true, title, message, type: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ isOpen: true, message, type: "success" });
  }, []);

  // 데이터 로드
  const loadBracketData = useCallback(async () => {
    if (!selectedDivision) return;
    setLoadingMessage("불러오는 중...");
    setLoading(true);

    try {
      const { data: configData } = await getOrCreateBracketConfig(
        selectedDivision.id,
      );
      if (configData) {
        setConfig(configData);

        // 조편성은 항상 로드 (예선 유무와 무관)
        const { data: groupsData } = await getPreliminaryGroups(
          configData.id,
        );
        setGroups(groupsData || []);

        // 예선 경기는 예선 모드일 때만 로드
        if (configData.has_preliminaries) {
          const { data: prelimData } = await getPreliminaryMatches(
            configData.id,
          );
          setPreliminaryMatches(prelimData || []);
        } else {
          setPreliminaryMatches([]);
        }

        const { data: mainData } = await getMainBracketMatches(configData.id);
        setMainMatches(mainData || []);

        // 시드 배치 데이터 로딩 조건:
        // 1) 예선 있는 대회에서 본선 미생성 (1R 시드 배치)
        // 2) 본선 매치 있지만 결승 미존재 (2R+ 시드 배치)
        const hasFinal = (mainData || []).some(m => m.phase === 'FINAL');
        const shouldLoadSeeds =
          (configData.has_preliminaries && (!mainData || mainData.length === 0)) ||
          (mainData && mainData.length > 0 && !hasFinal);

        if (shouldLoadSeeds) {
          const { data: nextData } = await getNextRoundTeams(configData.id);
          if (nextData && nextData.teams.length > 0 && !nextData.isComplete) {
            // bracketSize 계산 (1R: 팀 수 기반, 2R+: config에서)
            const teamCount = nextData.teams.length;
            const bracketSize =
              nextData.nextRound === 1
                ? (teamCount <= 4 ? 4
                  : teamCount <= 8 ? 8
                  : teamCount <= 16 ? 16
                  : teamCount <= 32 ? 32
                  : teamCount <= 64 ? 64
                  : 128)
                : configData.bracket_size!;
            const totalRounds = Math.log2(bracketSize);
            // 다음 라운드 매치 수
            const matchesInNextRound = Math.pow(2, totalRounds - nextData.nextRound);

            const virtualGroups: PreliminaryGroup[] = [];
            for (let i = 0; i < matchesInNextRound; i++) {
              const team1 = nextData.teams[i * 2];
              const team2 = nextData.teams[i * 2 + 1];
              const groupTeams = [team1, team2]
                .filter((t): t is NonNullable<typeof t> => !!t)
                .map((t) => ({
                  id: `seeding-team-${t.entryId}`,
                  entry_id: t.entryId,
                  seed_number: t.seed,
                  final_rank: null,
                  wins: 0,
                  losses: 0,
                  points_for: 0,
                  points_against: 0,
                  entry: t.entry,
                }));
              virtualGroups.push({
                id: `seeding-group-${i}`,
                name: `${i + 1}`,
                display_order: i + 1,
                group_teams: groupTeams,
              });
            }
            setSeedingGroups(virtualGroups);
            setAllPrelimsDone(nextData.allDone);
            setNextPhaseLabel(phaseLabels[nextData.nextPhase] || "");
          } else {
            setSeedingGroups([]);
            setAllPrelimsDone(nextData?.allDone ?? false);
            setNextPhaseLabel("");
          }
        } else {
          setSeedingGroups([]);
          setNextPhaseLabel("");
        }
      }
    } catch {
      showError("오류", "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedDivision, showError]);

  // 부서 변경 시 데이터 로드
  useEffect(() => {
    if (selectedDivision) {
      loadBracketData();
    }
  }, [selectedDivision, loadBracketData]);

  // Realtime 구독 — config가 있을 때만 활성화
  // Realtime payload에는 JOIN 데이터(team1/team2 이름)가 없으므로 기존 상태와 병합
  // Realtime payload → 기존 BracketMatch에 병합 (team1/team2 JOIN 데이터 보존)
  const mergeRealtimePayload = useCallback(
    (existing: BracketMatch, payload: RealtimeMatchPayload): BracketMatch => ({
      ...existing,
      team1_entry_id: payload.team1_entry_id,
      team2_entry_id: payload.team2_entry_id,
      team1_score: payload.team1_score,
      team2_score: payload.team2_score,
      winner_entry_id: payload.winner_entry_id,
      status: payload.status as BracketMatch["status"],
      court_location: payload.court_location,
      court_number: payload.court_number,
      sets_detail: payload.sets_detail as BracketMatch["sets_detail"],
    }),
    [],
  );

  // Realtime 이벤트용: 로딩 오버레이 없이 매치 데이터만 조용히 refetch
  // request counter로 stale 응답 무시 (race condition 방지)
  const requestCounterRef = useRef(0);

  const refetchMatchesSilently = useCallback(async () => {
    if (!config) return;
    const requestId = ++requestCounterRef.current;
    try {
      if (config.has_preliminaries) {
        const { data } = await getPreliminaryMatches(config.id);
        if (requestId !== requestCounterRef.current) return;
        if (data) setPreliminaryMatches(data);
      }
      const { data } = await getMainBracketMatches(config.id);
      if (requestId !== requestCounterRef.current) return;
      if (data) setMainMatches(data);
    } catch {
      // silent — Realtime 보조 refetch이므로 에러 무시
    }
  }, [config]);

  // ref로 최신 함수 참조 유지 (stale closure 방지)
  const refetchMatchesRef = useRef(refetchMatchesSilently);
  refetchMatchesRef.current = refetchMatchesSilently;

  // 디바운스된 refetch 스케줄러 — 연속 점수 입력 시 하나로 묶음
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      refetchMatchesRef.current();
      reloadTimerRef.current = null;
    }, 500);
  }, []);

  // 현재 matches를 ref로 유지 (handleMatchUpdate에서 entry_id 비교용)
  // React 18 batching에서 setState 함수형 업데이터는 비동기 실행될 수 있으므로
  // ref로 동기적 비교 필요
  const preliminaryMatchesRef = useRef(preliminaryMatches);
  preliminaryMatchesRef.current = preliminaryMatches;
  const mainMatchesRef = useRef(mainMatches);
  mainMatchesRef.current = mainMatches;

  const handleMatchUpdate = useCallback(
    (payload: RealtimeMatchPayload) => {
      // entry_id 변경 감지를 ref로 동기적 비교 (setState 내부가 아닌 외부에서)
      const prelimTarget = preliminaryMatchesRef.current.find((m) => m.id === payload.id);
      const mainTarget = mainMatchesRef.current.find((m) => m.id === payload.id);
      const target = prelimTarget || mainTarget;
      const needsRefetch = !!(
        target &&
        (target.team1_entry_id !== payload.team1_entry_id ||
          target.team2_entry_id !== payload.team2_entry_id)
      );

      const mergeMatches = (prev: BracketMatch[]) =>
        prev.map((m) =>
          m.id === payload.id ? mergeRealtimePayload(m, payload) : m,
        );

      setPreliminaryMatches(mergeMatches);
      setMainMatches(mergeMatches);

      // entry_id 변경 시 디바운스된 refetch로 JOIN 데이터 갱신
      if (needsRefetch) {
        scheduleRefetch();
      }
    },
    [mergeRealtimePayload, scheduleRefetch],
  );

  // admin은 자체 액션 후 loadBracketData를 직접 호출하므로
  // Realtime onReload는 다른 admin의 변경만 조용히 반영
  useMatchesRealtime({
    bracketConfigId: config?.id || "",
    onMatchUpdate: handleMatchUpdate,
    onReload: scheduleRefetch,
    enabled: !!config?.id,
  });

  const handleConfigUpdate = async (updates: Partial<BracketConfig>) => {
    if (!config) return;

    try {
      const { data } = await updateBracketConfig(config.id, updates);
      if (data) {
        setConfig(data);
      }
    } catch {
      showError("오류", "설정 업데이트 중 오류가 발생했습니다.");
    }
  };

  const handleAutoGenerateGroups = async () => {
    if (!config || !selectedDivision) return;

    // 다이얼로그 즉시 닫고 로딩 오버레이로 전환
    setShowAutoGenerateConfirm(false);
    setLoadingMessage("조 편성 중...");
    setLoading(true);
    try {
      const { error } = await autoGenerateGroups(
        config.id,
        selectedDivision.id,
      );
      if (error) {
        showError("조 편성 실패", error);
      } else {
        await loadBracketData();
        setActiveTab("groups");
        showSuccess("자동 조 편성이 완료되었습니다.");
      }
    } catch {
      showError("오류", "조 편성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreliminaryMatches = async () => {
    if (!config) return;

    setShowGeneratePrelimConfirm(false);
    setLoadingMessage("예선 경기 생성 중...");
    setLoading(true);
    try {
      const { error } = await generatePreliminaryMatches(config.id);
      if (error) {
        showError("예선 경기 생성 실패", error);
      } else {
        await loadBracketData();
        setActiveTab("preliminary");
        showSuccess("예선 경기가 생성되었습니다.");
      }
    } catch {
      showError("오류", "예선 경기 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainBracket = async () => {
    if (!config || !selectedDivision) return;

    // ref에서 동기적으로 시드 순서 읽기 (클로저 안전)
    const seedOrder = pendingSeedOrderRef.current;

    // 다이얼로그 즉시 닫고 로딩 오버레이로 전환
    setShowGenerateMainConfirm(false);
    setLoadingMessage("대진표 생성 중...");
    setLoading(true);
    try {
      // 시드 배치(DnD) 경유 → 라운드별 순차 생성
      const { data, error } = seedOrder.length > 0
        ? await generateNextRound(config.id, selectedDivision.id, seedOrder)
        : await generateMainBracket(config.id, selectedDivision.id);

      if (error) {
        showError("대진표 생성 실패", error);
      } else {
        pendingSeedOrderRef.current = [];
        setPendingSeedOrder([]);
        await loadBracketData();
        setActiveTab("main");
        const label = data && 'targetRound' in data
          ? `${data.targetRound}라운드 대진표가 생성되었습니다. (${data.matchCount}경기)`
          : `본선 대진표가 생성되었습니다. (${data?.bracketSize}강)`;
        showSuccess(label);
      }
    } catch {
      showError("오류", "대진표 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 시드 배치 미리보기에서 시드 순서 확인 후 생성 요청
  const handleRequestGenerateMainWithSeeds = useCallback((seedOrder: (string | null)[]) => {
    pendingSeedOrderRef.current = seedOrder;
    setPendingSeedOrder(seedOrder);
    setShowGenerateMainConfirm(true);
  }, []);

  // 테스트용: 예선 자동 결과 입력
  const handleAutoFillPreliminary = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const { data, error } = await autoFillPreliminaryResults(config.id);
      if (error) {
        showError("자동 입력 실패", error);
      } else {
        await loadBracketData();
        showSuccess(`예선 ${data?.filledCount}경기 결과가 자동 입력되었습니다.`);
      }
    } catch {
      showError("오류", "자동 결과 입력 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 테스트용: 본선 특정 강(phase) 자동 결과 입력
  const handleAutoFillMainPhase = async (phase: MatchPhase) => {
    if (!config) return;
    setLoading(true);
    try {
      const { data, error } = await autoFillMainBracketResults(config.id, phase);
      if (error) {
        showError("자동 입력 실패", error);
      } else {
        await loadBracketData();
        showSuccess(`${data?.filledCount}경기 결과가 자동 입력되었습니다.`);
      }
    } catch {
      showError("오류", "자동 결과 입력 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCourtBatchSave = async (updates: CourtInfoUpdate[]) => {
    try {
      const { error } = await batchUpdateMatchCourtInfo(updates);
      if (error) {
        showError("코트 정보 실패", error);
      } else {
        showSuccess("코트 정보가 저장되었습니다.");
        // Realtime이 자동으로 업데이트하므로 리페치 불필요
      }
    } catch {
      showError("오류", "코트 정보 업데이트 중 오류가 발생했습니다.");
    }
  };

  const handleMatchResult = async (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => {
    try {
      const { error } = await updateMatchResult(matchId, team1Score, team2Score);
      if (error) {
        showError("경기 결과 입력 실패", error);
      } else {
        showSuccess("경기 결과가 저장되었습니다.");
        // 승자 전파로 다음 라운드 매치에 팀이 배정되므로 JOIN 데이터 갱신
        refetchMatchesRef.current();
      }
    } catch {
      showError("오류", "경기 결과 입력 중 오류가 발생했습니다.");
    }
  };

  const handleTieWarning = useCallback(() => {
    setAlertDialog({
      isOpen: true,
      title: "경고",
      message: "동점은 허용되지 않습니다.",
      type: "warning",
    });
  }, []);

  // 단체전 세트별 결과 입력 모달 열기
  const handleOpenDetail = useCallback((match: BracketMatch) => {
    setDetailMatch(match);
  }, []);

  // 단체전 세트별 결과 저장
  const handleMatchResultWithSets = async (
    matchId: string,
    team1Score: number,
    team2Score: number,
    setsDetail: SetDetail[],
  ) => {
    setDetailMatch(null);
    try {
      const { error } = await updateMatchResult(matchId, team1Score, team2Score, setsDetail);
      if (error) {
        showError("경기 결과 입력 실패", error);
      } else {
        showSuccess("경기 결과가 저장되었습니다.");
        // 승자 전파로 다음 라운드 매치에 팀이 배정되므로 JOIN 데이터 갱신
        refetchMatchesRef.current();
      }
    } catch {
      showError("오류", "경기 결과 입력 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteGroups = async () => {
    if (!config) return;

    setShowDeleteGroupsConfirm(false);
    setLoadingMessage("조 편성 삭제 중...");
    setLoading(true);
    try {
      const { error } = await deletePreliminaryGroups(config.id);
      if (error) {
        showError("삭제 실패", error);
      } else {
        await loadBracketData();
        showSuccess("조 편성이 삭제되었습니다.");
      }
    } catch {
      showError("오류", "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreliminaryMatches = async () => {
    if (!config) return;

    setShowDeletePrelimConfirm(false);
    setLoadingMessage("예선 경기 삭제 중...");
    setLoading(true);
    try {
      const { error } = await deletePreliminaryMatches(config.id);
      if (error) {
        showError("삭제 실패", error);
      } else {
        await loadBracketData();
        showSuccess("예선 경기가 삭제되었습니다.");
      }
    } catch {
      showError("오류", "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMainBracket = async () => {
    if (!config) return;

    setShowDeleteMainConfirm(false);
    setLoadingMessage("본선 대진표 삭제 중...");
    setLoading(true);
    try {
      const { error } = await deleteMainBracket(config.id);
      if (error) {
        showError("삭제 실패", error);
      } else {
        await loadBracketData();
        showSuccess("본선 대진표가 삭제되었습니다.");
      }
    } catch {
      showError("오류", "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLatestRound = async () => {
    if (!config) return;

    setShowDeleteLatestRoundConfirm(false);
    setLoadingMessage("최신 라운드 삭제 중...");
    setLoading(true);
    try {
      const { error } = await deleteLatestRound(config.id);
      if (error) {
        showError("삭제 실패", error);
      } else {
        await loadBracketData();
        showSuccess("최신 라운드가 삭제되었습니다.");
      }
    } catch {
      showError("오류", "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBracket = async () => {
    if (!config) return;

    setShowDeleteBracketConfirm(false);
    setLoadingMessage("전체 대진표 삭제 중...");
    setLoading(true);
    try {
      const { error } = await deleteBracketConfig(config.id);
      if (error) {
        showError("삭제 실패", error);
      } else {
        await loadBracketData();
        showSuccess("전체 대진표가 삭제되었습니다.");
      }
    } catch {
      showError("오류", "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (divisions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
        <p className="text-(--text-secondary)">
          대진표를 생성하려면 먼저 참가 부서를 추가해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message={loadingMessage} />}

      {/* Division Selector */}
      <div className="flex flex-wrap gap-2">
        {divisions.map((division) => (
          <button
            key={division.id}
            onClick={() => setSelectedDivision(division)}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-(--bg-primary) ${
              selectedDivision?.id === division.id
                ? "bg-(--accent-color)"
                : "bg-(--bg-card) text-(--text-secondary) hover:bg-(--bg-card-hover)"
            }`}
          >
            {division.name}
          </button>
        ))}
      </div>

      {selectedDivision && config && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-(--bg-card) rounded-xl">
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-(--bg-primary) ${
                activeTab === "settings"
                  ? "bg-(--accent-color)"
                  : "hover:bg-white/10 text-(--text-secondary)"
              }`}
            >
              <Settings className="w-4 h-4" />
              설정
            </button>
            {/* 조 편성 탭은 항상 표시 */}
            <button
              onClick={() => setActiveTab("groups")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-(--bg-primary) ${
                activeTab === "groups"
                  ? "bg-(--accent-color)"
                  : "hover:bg-white/10 text-(--text-secondary)"
              }`}
            >
              <Users className="w-4 h-4" />조 편성
            </button>
            {/* 예선 탭은 예선 사용 시에만 */}
            {config.has_preliminaries && (
              <button
                onClick={() => setActiveTab("preliminary")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-(--bg-primary) ${
                  activeTab === "preliminary"
                    ? "bg-(--accent-color)"
                    : "hover:bg-white/10 text-(--text-secondary)"
                }`}
              >
                <Play className="w-4 h-4" />
                예선
              </button>
            )}
            <button
              onClick={() => setActiveTab("main")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-(--bg-primary) ${
                activeTab === "main"
                  ? "bg-(--accent-color)"
                  : "hover:bg-white/10 text-(--text-secondary)"
              }`}
            >
              <Trophy className="w-4 h-4" />
              본선
            </button>
          </div>

          {/* Tab Content */}
          {/* 조 편성 탭과 본선 시드 배치 모드에서는 bg-(--bg-card)로 통일 (DnD 시 glass-card hover 방지) */}
          <div
            className={`rounded-xl p-6 border border-(--border-color) ${
              activeTab === "groups" ||
              (activeTab === "main" && seedingGroups.length > 0)
                ? "bg-(--bg-card)"
                : "glass-card"
            }`}
          >
            {isClosed && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
                마감된 대회입니다. 대진표를 수정할 수 없습니다.
              </div>
            )}

            {activeTab === "settings" && (
              <SettingsTab
                config={config}
                onUpdate={isClosed ? undefined : handleConfigUpdate}
                onDelete={isClosed ? undefined : () => setShowDeleteBracketConfirm(true)}
              />
            )}

            {activeTab === "groups" && (
              <GroupsTab
                groups={groups}
                hasPreliminary={config.has_preliminaries}
                onAutoGenerate={isClosed ? undefined : () => {
                  setAutoGenerateConfirmMessage(
                    groups.length > 0
                      ? `자동 조 편성을 하시겠습니까?\n기존 조 편성이 삭제됩니다.`
                      : `자동 조 편성을 하시겠습니까?`,
                  );
                  setShowAutoGenerateConfirm(true);
                }}
                onGenerateMatches={isClosed ? undefined : () => setShowGeneratePrelimConfirm(true)}
                onGenerateMainBracket={isClosed ? undefined : (seedOrder: (string | null)[]) => {
                  pendingSeedOrderRef.current = seedOrder;
                  setPendingSeedOrder(seedOrder);
                  setShowGenerateMainConfirm(true);
                }}
                onDelete={isClosed ? undefined : () => setShowDeleteGroupsConfirm(true)}
                onTeamMove={isClosed ? undefined : loadBracketData}
                onError={(msg) => showError("오류", msg)}
              />
            )}

            {activeTab === "preliminary" && (
              <PreliminaryTab
                groups={groups}
                matches={preliminaryMatches}
                onMatchResult={isClosed ? undefined : handleMatchResult}
                onAutoFill={isClosed ? undefined : handleAutoFillPreliminary}
                onDelete={isClosed ? undefined : () => setShowDeletePrelimConfirm(true)}
                onTieWarning={handleTieWarning}
                isTeamMatch={isTeamMatch}
                onOpenDetail={isClosed ? undefined : handleOpenDetail}
                onCourtBatchSave={isClosed ? undefined : handleCourtBatchSave}
              />
            )}

            {activeTab === "main" && (
              <MainBracketTab
                config={config}
                matches={mainMatches}
                onGenerateBracket={isClosed ? undefined : () => setShowGenerateMainConfirm(true)}
                onAutoFillPhase={isClosed ? undefined : handleAutoFillMainPhase}
                onMatchResult={isClosed ? undefined : handleMatchResult}
                onDelete={isClosed ? undefined : () => setShowDeleteMainConfirm(true)}
                onDeleteLatestRound={isClosed ? undefined : () => setShowDeleteLatestRoundConfirm(true)}
                onTieWarning={handleTieWarning}
                isTeamMatch={isTeamMatch}
                onOpenDetail={isClosed ? undefined : handleOpenDetail}
                onCourtBatchSave={isClosed ? undefined : handleCourtBatchSave}
                seedingGroups={seedingGroups.length > 0 ? seedingGroups : undefined}
                allPrelimsDone={allPrelimsDone}
                nextPhaseLabel={nextPhaseLabel}
                onGenerateBracketWithSeeds={isClosed ? undefined : handleRequestGenerateMainWithSeeds}
                onRefreshNextRound={isClosed ? undefined : loadBracketData}
              />
            )}
          </div>
        </>
      )}

      {/* Alert Dialog — 단일 인스턴스 */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      {/* Toast */}
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />

      {/* 단체전 세트별 결과 입력 모달 */}
      {isTeamMatch && teamMatchCount && matchType && (
        <MatchDetailModal
          isOpen={detailMatch !== null}
          onClose={() => setDetailMatch(null)}
          onSave={handleMatchResultWithSets}
          match={detailMatch}
          teamMatchCount={teamMatchCount}
          matchType={matchType}
        />
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showAutoGenerateConfirm}
        onClose={() => setShowAutoGenerateConfirm(false)}
        onConfirm={handleAutoGenerateGroups}
        title="자동 조 편성"
        message={autoGenerateConfirmMessage}
        type="warning"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showGeneratePrelimConfirm}
        onClose={() => setShowGeneratePrelimConfirm(false)}
        onConfirm={handleGeneratePreliminaryMatches}
        title="예선 경기 생성"
        message="예선 경기를 생성하시겠습니까?"
        type="info"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showGenerateMainConfirm}
        onClose={() => {
          setShowGenerateMainConfirm(false);
          pendingSeedOrderRef.current = [];
          setPendingSeedOrder([]);
        }}
        onConfirm={handleGenerateMainBracket}
        title="대진표 생성"
        message={
          pendingSeedOrder.length > 0
            ? `현재 시드 배정 순서대로 ${nextPhaseLabel || "본선"} 대진표를 생성하시겠습니까?`
            : "현재 조 편성 순서대로 본선 대진표를 생성하시겠습니까?"
        }
        type="info"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showDeleteGroupsConfirm}
        onClose={() => setShowDeleteGroupsConfirm(false)}
        onConfirm={handleDeleteGroups}
        title="조 편성 삭제"
        message={`조 편성을 삭제하시겠습니까?\n조 배정 및 예선 경기가 모두 삭제됩니다.`}
        type="error"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showDeletePrelimConfirm}
        onClose={() => setShowDeletePrelimConfirm(false)}
        onConfirm={handleDeletePreliminaryMatches}
        title="예선 경기 삭제"
        message={`예선 경기를 삭제하시겠습니까?\n조 편성은 유지됩니다.`}
        type="error"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showDeleteMainConfirm}
        onClose={() => setShowDeleteMainConfirm(false)}
        onConfirm={handleDeleteMainBracket}
        title="본선 대진표 삭제"
        message={`본선 대진표를 삭제하시겠습니까?\n조 편성은 유지됩니다.`}
        type="error"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showDeleteLatestRoundConfirm}
        onClose={() => setShowDeleteLatestRoundConfirm(false)}
        onConfirm={handleDeleteLatestRound}
        title="최신 라운드 삭제"
        message="최신 라운드를 삭제하시겠습니까? 이전 라운드의 경기 연결이 초기화됩니다."
        type="warning"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={showDeleteBracketConfirm}
        onClose={() => setShowDeleteBracketConfirm(false)}
        onConfirm={handleDeleteBracket}
        title="전체 대진표 설정 삭제"
        message={`전체 대진표 설정을 삭제하시겠습니까?\n모든 조 편성, 예선, 본선 데이터가 영구적으로 삭제됩니다.`}
        type="error"
        isLoading={loading}
      />
    </div>
  );
}
