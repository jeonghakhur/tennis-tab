"use client";

import { useState, useEffect, useCallback } from "react";
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
  getMainBracketMatches,
  updateMatchResult,
  autoFillPreliminaryResults,
  autoFillMainBracketResults,
  deleteBracketConfig,
  deletePreliminaryGroups,
  deletePreliminaryMatches,
  deleteMainBracket,
} from "@/lib/bracket/actions";
import { SettingsTab } from "./SettingsTab";
import { GroupsTab } from "./GroupsTab";
import { PreliminaryTab } from "./PreliminaryTab";
import { MainBracketTab } from "./MainBracketTab";
import { MatchDetailModal } from "./MatchDetailModal";
import type {
  BracketManagerProps,
  BracketConfig,
  PreliminaryGroup,
  BracketMatch,
  SetDetail,
} from "./types";

type TabType = "settings" | "groups" | "preliminary" | "main";

export function BracketManager({
  tournamentId,
  divisions,
  teamMatchCount,
  matchType,
}: BracketManagerProps) {
  // 단체전 여부 판별
  const isTeamMatch = matchType === "TEAM_SINGLES" || matchType === "TEAM_DOUBLES";
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

  const showError = useCallback((title: string, message: string) => {
    setAlertDialog({ isOpen: true, title, message, type: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ isOpen: true, message, type: "success" });
  }, []);

  // 데이터 로드
  const loadBracketData = useCallback(async () => {
    if (!selectedDivision) return;
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
      setShowAutoGenerateConfirm(false);
    }
  };

  const handleGeneratePreliminaryMatches = async () => {
    if (!config) return;

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
      setShowGeneratePrelimConfirm(false);
    }
  };

  const handleGenerateMainBracket = async () => {
    if (!config || !selectedDivision) return;

    setLoading(true);
    try {
      const { data, error } = await generateMainBracket(
        config.id,
        selectedDivision.id,
      );
      if (error) {
        showError("본선 대진표 생성 실패", error);
      } else {
        await loadBracketData();
        setActiveTab("main");
        showSuccess(
          `본선 대진표가 생성되었습니다. (${data?.bracketSize}강, ${data?.teamCount}팀)`,
        );
      }
    } catch {
      showError("오류", "본선 대진표 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setShowGenerateMainConfirm(false);
    }
  };

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

  // 테스트용: 본선 자동 결과 입력
  const handleAutoFillMain = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const { data, error } = await autoFillMainBracketResults(config.id);
      if (error) {
        showError("자동 입력 실패", error);
      } else {
        await loadBracketData();
        showSuccess(`본선 ${data?.filledCount}경기 결과가 자동 입력되었습니다.`);
      }
    } catch {
      showError("오류", "자동 결과 입력 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleMatchResult = async (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => {
    setLoading(true);
    try {
      const { error } = await updateMatchResult(matchId, team1Score, team2Score);
      if (error) {
        showError("경기 결과 입력 실패", error);
      } else {
        await loadBracketData();
      }
    } catch {
      showError("오류", "경기 결과 입력 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
    setLoading(true);
    try {
      const { error } = await updateMatchResult(matchId, team1Score, team2Score, setsDetail);
      if (error) {
        showError("경기 결과 입력 실패", error);
      } else {
        await loadBracketData();
      }
    } catch {
      showError("오류", "경기 결과 입력 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroups = async () => {
    if (!config) return;

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
      setShowDeleteGroupsConfirm(false);
    }
  };

  const handleDeletePreliminaryMatches = async () => {
    if (!config) return;

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
      setShowDeletePrelimConfirm(false);
    }
  };

  const handleDeleteMainBracket = async () => {
    if (!config) return;

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
      setShowDeleteMainConfirm(false);
    }
  };

  const handleDeleteBracket = async () => {
    if (!config) return;

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
      setShowDeleteBracketConfirm(false);
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
      {loading && <LoadingOverlay message="불러오는 중..." />}

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
          <div
            className={`rounded-xl p-6 border border-(--border-color) ${
              activeTab === "groups" ? "bg-(--bg-card)" : "glass-card"
            }`}
          >
            {activeTab === "settings" && (
              <SettingsTab
                config={config}
                onUpdate={handleConfigUpdate}
                onDelete={() => setShowDeleteBracketConfirm(true)}
              />
            )}

            {activeTab === "groups" && (
              <GroupsTab
                groups={groups}
                hasPreliminary={config.has_preliminaries}
                onAutoGenerate={() => {
                  setAutoGenerateConfirmMessage(
                    groups.length > 0
                      ? `자동 조 편성을 하시겠습니까?\n기존 조 편성이 삭제됩니다.`
                      : `자동 조 편성을 하시겠습니까?`,
                  );
                  setShowAutoGenerateConfirm(true);
                }}
                onGenerateMatches={() => setShowGeneratePrelimConfirm(true)}
                onGenerateMainBracket={() => setShowGenerateMainConfirm(true)}
                onDelete={() => setShowDeleteGroupsConfirm(true)}
                onTeamMove={loadBracketData}
                onError={(msg) => showError("오류", msg)}
              />
            )}

            {activeTab === "preliminary" && (
              <PreliminaryTab
                groups={groups}
                matches={preliminaryMatches}
                onMatchResult={handleMatchResult}
                onAutoFill={handleAutoFillPreliminary}
                onDelete={() => setShowDeletePrelimConfirm(true)}
                onTieWarning={handleTieWarning}
                isTeamMatch={isTeamMatch}
                onOpenDetail={handleOpenDetail}
              />
            )}

            {activeTab === "main" && (
              <MainBracketTab
                config={config}
                matches={mainMatches}
                onGenerateBracket={() => setShowGenerateMainConfirm(true)}
                onAutoFill={handleAutoFillMain}
                onMatchResult={handleMatchResult}
                onDelete={() => setShowDeleteMainConfirm(true)}
                onTieWarning={handleTieWarning}
                isTeamMatch={isTeamMatch}
                onOpenDetail={handleOpenDetail}
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
        onClose={() => setShowGenerateMainConfirm(false)}
        onConfirm={handleGenerateMainBracket}
        title="본선 대진표 생성"
        message="현재 조 편성 순서대로 본선 대진표를 생성하시겠습니까?"
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
