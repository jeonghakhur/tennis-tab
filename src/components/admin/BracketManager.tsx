"use client";

import { useState, useEffect } from "react";
import { Settings, Users, Trophy, Play, Check, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  ConfirmDialog,
  Toast,
} from "@/components/common/AlertDialog";
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
  deleteBracketConfig,
  deletePreliminaryGroups,
  deletePreliminaryMatches,
  deleteMainBracket,
} from "@/lib/bracket/actions";
import type {
  BracketStatus,
  MatchPhase,
  MatchStatus,
} from "@/lib/supabase/types";

interface Division {
  id: string;
  name: string;
  max_teams: number | null;
}

interface BracketManagerProps {
  tournamentId: string;
  divisions: Division[];
}

interface BracketConfig {
  id: string;
  division_id: string;
  has_preliminaries: boolean;
  third_place_match: boolean;
  bracket_size: number | null;
  status: BracketStatus;
}

interface GroupTeam {
  id: string;
  entry_id: string;
  seed_number: number | null;
  final_rank: number | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  entry?: {
    id: string;
    player_name: string;
    club_name: string | null;
  };
}

interface PreliminaryGroup {
  id: string;
  name: string;
  display_order: number;
  group_teams?: GroupTeam[];
}

interface BracketMatch {
  id: string;
  phase: MatchPhase;
  group_id: string | null;
  bracket_position: number | null;
  round_number: number | null;
  match_number: number;
  team1_entry_id: string | null;
  team2_entry_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  winner_entry_id: string | null;
  status: MatchStatus;
  team1?: { id: string; player_name: string; club_name: string | null };
  team2?: { id: string; player_name: string; club_name: string | null };
}

const phaseLabels: Record<MatchPhase, string> = {
  PRELIMINARY: "예선",
  ROUND_128: "128강",
  ROUND_64: "64강",
  ROUND_32: "32강",
  ROUND_16: "16강",
  QUARTER: "8강",
  SEMI: "4강",
  FINAL: "결승",
  THIRD_PLACE: "3/4위전",
};

export function BracketManager({
  tournamentId,
  divisions,
}: BracketManagerProps) {
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(
    divisions.length > 0 ? divisions[0] : null,
  );
  const [config, setConfig] = useState<BracketConfig | null>(null);
  const [groups, setGroups] = useState<PreliminaryGroup[]>([]);
  const [preliminaryMatches, setPreliminaryMatches] = useState<BracketMatch[]>(
    [],
  );
  const [mainMatches, setMainMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "settings" | "groups" | "preliminary" | "main"
  >("settings");

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

  // 부서 변경 시 데이터 로드
  useEffect(() => {
    if (selectedDivision) {
      loadBracketData();
    }
  }, [selectedDivision]);

  const loadBracketData = async () => {
    if (!selectedDivision) return;
    setLoading(true);

    try {
      // 대진표 설정 로드
      const { data: configData } = await getOrCreateBracketConfig(
        selectedDivision.id,
      );
      if (configData) {
        setConfig(configData);

        // 예선 조 로드
        if (configData.has_preliminaries) {
          const { data: groupsData } = await getPreliminaryGroups(
            configData.id,
          );
          setGroups(groupsData || []);

          const { data: prelimData } = await getPreliminaryMatches(
            configData.id,
          );
          setPreliminaryMatches(prelimData || []);
        }

        // 본선 경기 로드
        const { data: mainData } = await getMainBracketMatches(configData.id);
        setMainMatches(mainData || []);
      }
    } catch (error) {
      console.error("Failed to load bracket data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = async (updates: Partial<BracketConfig>) => {
    if (!config) return;

    try {
      const { data } = await updateBracketConfig(config.id, updates);
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to update config:", error);
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
        setAlertDialog({
          isOpen: true,
          title: "조 편성 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setActiveTab("groups");
        setToast({
          isOpen: true,
          message: "자동 조 편성이 완료되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to generate groups:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "조 편성 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "예선 경기 생성 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setActiveTab("preliminary");
        setToast({
          isOpen: true,
          message: "예선 경기가 생성되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to generate preliminary matches:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "예선 경기 생성 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "본선 대진표 생성 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setActiveTab("main");
        setToast({
          isOpen: true,
          message: `본선 대진표가 생성되었습니다. (${data?.bracketSize}강, ${data?.teamCount}팀)`,
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to generate main bracket:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "본선 대진표 생성 중 오류가 발생했습니다.",
        type: "error",
      });
    } finally {
      setLoading(false);
      setShowGenerateMainConfirm(false);
    }
  };

  const handleMatchResult = async (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => {
    setLoading(true);
    try {
      const { error } = await updateMatchResult(
        matchId,
        team1Score,
        team2Score,
      );
      if (error) {
        setAlertDialog({
          isOpen: true,
          title: "경기 결과 입력 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
      }
    } catch (error) {
      console.error("Failed to update match result:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "경기 결과 입력 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "삭제 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setToast({
          isOpen: true,
          message: "조 편성이 삭제되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to delete groups:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "삭제 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "삭제 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setToast({
          isOpen: true,
          message: "예선 경기가 삭제되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to delete preliminary matches:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "삭제 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "삭제 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setToast({
          isOpen: true,
          message: "본선 대진표가 삭제되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to delete main bracket:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "삭제 중 오류가 발생했습니다.",
        type: "error",
      });
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
        setAlertDialog({
          isOpen: true,
          title: "삭제 실패",
          message: error,
          type: "error",
        });
      } else {
        await loadBracketData();
        setToast({
          isOpen: true,
          message: "전체 대진표가 삭제되었습니다.",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to delete bracket:", error);
      setAlertDialog({
        isOpen: true,
        title: "오류",
        message: "삭제 중 오류가 발생했습니다.",
        type: "error",
      });
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
            {config.has_preliminaries && (
              <>
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
              </>
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
          <div className="glass-card rounded-xl p-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-(--accent-color)" />
              </div>
            )}

            {!loading && activeTab === "settings" && (
              <SettingsTab
                config={config}
                onUpdate={handleConfigUpdate}
                onDelete={() => setShowDeleteBracketConfirm(true)}
              />
            )}

            {!loading && activeTab === "groups" && (
              <GroupsTab
                groups={groups}
                onAutoGenerate={() => {
                  setAutoGenerateConfirmMessage(
                    groups.length > 0
                      ? `자동 조 편성을 하시겠습니까?\n기존 조 편성이 삭제됩니다.`
                      : `자동 조 편성을 하시겠습니까?`,
                  );
                  setShowAutoGenerateConfirm(true);
                }}
                onGenerateMatches={() => setShowGeneratePrelimConfirm(true)}
                onDelete={() => setShowDeleteGroupsConfirm(true)}
              />
            )}

            {!loading && activeTab === "preliminary" && (
              <PreliminaryTab
                groups={groups}
                matches={preliminaryMatches}
                onMatchResult={handleMatchResult}
                onDelete={() => setShowDeletePrelimConfirm(true)}
              />
            )}

            {!loading && activeTab === "main" && (
              <MainBracketTab
                config={config}
                matches={mainMatches}
                onGenerateBracket={() => setShowGenerateMainConfirm(true)}
                onMatchResult={handleMatchResult}
                onDelete={() => setShowDeleteMainConfirm(true)}
              />
            )}
          </div>
        </>
      )}

      {/* Alert Dialog */}
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
        message="본선 대진표를 생성하시겠습니까?"
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
        message={`본선 대진표를 삭제하시겠습니까?\n예선은 유지됩니다.`}
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

// ============================================================================
// 설정 탭
// ============================================================================
function SettingsTab({
  config,
  onUpdate,
  onDelete,
}: {
  config: BracketConfig;
  onUpdate: (updates: Partial<BracketConfig>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg font-semibold text-(--text-primary)">
        대진표 설정
      </h3>

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.has_preliminaries}
            onChange={(e) => onUpdate({ has_preliminaries: e.target.checked })}
            disabled={config.status !== "DRAFT"}
            className="w-5 h-5 rounded border-(--border-color) text-(--accent-color) focus:ring-(--accent-color)"
          />
          <span className="text-(--text-primary)">예선전 진행</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.third_place_match}
            onChange={(e) => onUpdate({ third_place_match: e.target.checked })}
            disabled={config.status === "COMPLETED"}
            className="w-5 h-5 rounded border-(--border-color) text-(--accent-color) focus:ring-(--accent-color)"
          />
          <span className="text-(--text-primary)">3/4위전 진행</span>
        </label>
      </div>

      <div className="pt-4 border-t border-(--border-color)">
        <div className="flex items-center gap-2">
          <span className="text-(--text-secondary)">상태:</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              config.status === "DRAFT"
                ? "bg-gray-500/20 text-gray-400"
                : config.status === "PRELIMINARY"
                  ? "bg-amber-500/20 text-amber-400"
                  : config.status === "MAIN"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {config.status === "DRAFT"
              ? "준비중"
              : config.status === "PRELIMINARY"
                ? "예선 진행중"
                : config.status === "MAIN"
                  ? "본선 진행중"
                  : "완료"}
          </span>
        </div>
        {config.bracket_size && (
          <p className="text-sm text-(--text-muted) mt-2">
            본선 대진표 크기: {config.bracket_size}강
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-(--border-color)">
        <button
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors text-sm font-medium"
        >
          전체 대진표 설정 삭제
        </button>
        <p className="text-xs text-(--text-muted) mt-2">
          모든 조 편성, 예선, 본선 데이터가 영구적으로 삭제되며, 대진표 설정이
          초기화됩니다.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 조 편성 탭
// ============================================================================
function GroupsTab({
  groups,
  onAutoGenerate,
  onGenerateMatches,
  onDelete,
}: {
  groups: PreliminaryGroup[];
  onAutoGenerate: () => void;
  onGenerateMatches: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-(--text-primary)">
          예선 조 편성
        </h3>
        <div className="flex gap-2">
          <button onClick={onAutoGenerate} className="btn-secondary btn-sm">
            <span className="relative z-10">자동 편성</span>
          </button>
          {groups.length > 0 && (
            <>
              <button
                onClick={onGenerateMatches}
                className="btn-primary btn-sm"
              >
                <span className="relative z-10">예선 경기 생성</span>
              </button>
              <button
                onClick={onDelete}
                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors text-sm font-medium"
              >
                조 편성 삭제
              </button>
            </>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-8 text-(--text-muted)">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>조 편성이 없습니다. 자동 편성 버튼을 클릭하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-xl border border-(--border-color) bg-(--bg-card)"
            >
              <h4 className="font-display font-semibold text-(--text-primary) mb-3">
                {group.name}조
              </h4>
              <div className="space-y-2">
                {group.group_teams?.map((team, index) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-(--bg-secondary)"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-(--accent-color)/20 text-(--accent-color) text-xs font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {team.entry?.club_name && (
                        <p className="text-sm font-medium text-(--text-primary) truncate">
                          {team.entry.club_name}
                        </p>
                      )}
                      <p
                        className={`truncate ${team.entry?.club_name ? "text-xs text-(--text-muted)" : "text-sm font-medium text-(--text-primary)"}`}
                      >
                        {team.entry?.player_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 예선 탭
// ============================================================================
function PreliminaryTab({
  groups,
  matches,
  onMatchResult,
  onDelete,
}: {
  groups: PreliminaryGroup[];
  matches: BracketMatch[];
  onMatchResult: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-(--text-primary)">
          예선 경기
        </h3>
        {matches.length > 0 && (
          <button
            onClick={onDelete}
            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors text-sm font-medium"
          >
            예선 경기 삭제
          </button>
        )}
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
            const standings = group.group_teams?.slice().sort((a, b) => {
              if (a.final_rank && b.final_rank)
                return a.final_rank - b.final_rank;
              return b.wins - b.losses - (a.wins - a.losses);
            });

            return (
              <div key={group.id} className="space-y-4">
                <h4 className="font-display font-semibold text-(--text-primary)">
                  {group.name}조
                </h4>

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

// ============================================================================
// 본선 탭
// ============================================================================
function MainBracketTab({
  config,
  matches,
  onGenerateBracket,
  onMatchResult,
  onDelete,
}: {
  config: BracketConfig;
  matches: BracketMatch[];
  onGenerateBracket: () => void;
  onMatchResult: (
    matchId: string,
    team1Score: number,
    team2Score: number,
  ) => void;
  onDelete: () => void;
}) {
  // 라운드별로 경기 그룹화
  const matchesByPhase = matches.reduce(
    (acc, match) => {
      if (!acc[match.phase]) acc[match.phase] = [];
      acc[match.phase].push(match);
      return acc;
    },
    {} as Record<MatchPhase, BracketMatch[]>,
  );

  const phaseOrder: MatchPhase[] = [
    "ROUND_128",
    "ROUND_64",
    "ROUND_32",
    "ROUND_16",
    "QUARTER",
    "SEMI",
    "THIRD_PLACE",
    "FINAL",
  ];

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
          {phaseOrder.map((phase) => {
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

// ============================================================================
// 경기 행 컴포넌트
// ============================================================================
function MatchRow({
  match,
  onResult,
}: {
  match: BracketMatch;
  onResult: (matchId: string, team1Score: number, team2Score: number) => void;
}) {
  const [team1Score, setTeam1Score] = useState(
    match.team1_score?.toString() || "",
  );
  const [team2Score, setTeam2Score] = useState(
    match.team2_score?.toString() || "",
  );
  const [editing, setEditing] = useState(false);
  const [showTieWarning, setShowTieWarning] = useState(false);

  const handleSubmit = () => {
    const s1 = parseInt(team1Score) || 0;
    const s2 = parseInt(team2Score) || 0;
    if (s1 === s2) {
      setShowTieWarning(true);
      return;
    }
    onResult(match.id, s1, s2);
    setEditing(false);
  };

  const team1Label = match.team1?.club_name
    ? `${match.team1.club_name} ${match.team1.player_name}`
    : match.team1?.player_name || "TBD";
  const team2Label = match.team2?.club_name
    ? `${match.team2.club_name} ${match.team2.player_name}`
    : match.team2?.player_name || "TBD";

  if (match.status === "BYE") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-secondary) opacity-60">
        <span className="text-xs text-(--text-muted)">
          #{match.match_number}
        </span>
        <div className="flex-1">
          <span className="text-sm text-(--text-primary)">{team1Label}</span>
          <span className="ml-2 text-xs text-(--text-muted)">(부전승)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        match.status === "COMPLETED"
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-(--bg-secondary) border-(--border-color)"
      }`}
    >
      <span className="text-xs text-(--text-muted) w-8">
        #{match.match_number}
      </span>

      {/* Team 1 */}
      <div
        className={`flex-1 text-right ${
          match.winner_entry_id === match.team1_entry_id
            ? "font-bold text-emerald-400"
            : "text-(--text-primary)"
        }`}
      >
        <span className="text-sm">{team1Label}</span>
      </div>

      {/* Score */}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(e.target.value)}
            className="w-12 px-2 py-1 text-center rounded bg-(--bg-card) border border-(--border-color) text-(--text-primary)"
            min="0"
          />
          <span className="text-(--text-muted)">:</span>
          <input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(e.target.value)}
            className="w-12 px-2 py-1 text-center rounded bg-(--bg-card) border border-(--border-color) text-(--text-primary)"
            min="0"
          />
          <button
            onClick={handleSubmit}
            className="p-1 rounded bg-emerald-500 text-white"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-(--bg-card) hover:bg-(--bg-card-hover) transition-colors"
          disabled={!match.team1_entry_id || !match.team2_entry_id}
        >
          <span className="text-(--text-primary) font-mono">
            {match.team1_score ?? "-"}
          </span>
          <span className="text-(--text-muted)">:</span>
          <span className="text-(--text-primary) font-mono">
            {match.team2_score ?? "-"}
          </span>
        </button>
      )}

      {/* Team 2 */}
      <div
        className={`flex-1 text-left ${
          match.winner_entry_id === match.team2_entry_id
            ? "font-bold text-emerald-400"
            : "text-(--text-primary)"
        }`}
      >
        <span className="text-sm">{team2Label}</span>
      </div>

      {/* Tie Warning Dialog */}
      <AlertDialog
        isOpen={showTieWarning}
        onClose={() => setShowTieWarning(false)}
        title="경고"
        message="동점은 허용되지 않습니다."
        type="warning"
      />
    </div>
  );
}
