"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, GripVertical, Shuffle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { moveTeamToGroup } from "@/lib/bracket/actions";
import type { PreliminaryGroup, GroupTeam } from "./types";

interface GroupsTabProps {
  groups: PreliminaryGroup[];
  hasPreliminary: boolean;
  title?: string;
  generateButtonLabel?: string;
  onAutoGenerate?: () => void;
  onGenerateMatches?: () => void;
  onGenerateMainBracket?: (seedOrder: (string | null)[]) => void;
  onDelete?: () => void;
  onTeamMove?: () => Promise<void>;
  onError: (message: string) => void;
}

export function GroupsTab({
  groups,
  hasPreliminary,
  title = "예선 조 편성",
  generateButtonLabel,
  onAutoGenerate,
  onGenerateMatches,
  onGenerateMainBracket,
  onDelete,
  onTeamMove,
  onError,
}: GroupsTabProps) {
  const [localGroups, setLocalGroups] = useState(groups);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // groups prop이 변경되면 로컬 상태 업데이트
  useEffect(() => {
    setLocalGroups(groups);
    setHasChanges(false);
  }, [groups]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // 팀 또는 그룹 ID로 어느 그룹에 속하는지 찾기
  const findGroupByItemId = (id: string) => {
    const groupWithTeam = localGroups.find((g) =>
      g.group_teams?.some((t) => t.id === id),
    );
    if (groupWithTeam) return groupWithTeam;
    return localGroups.find((g) => g.id === id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    if (activeItemId === overId) return;

    setLocalGroups((prevGroups) => {
      const activeGroup = prevGroups.find((g) =>
        g.group_teams?.some((t) => t.id === activeItemId),
      );
      const overGroup = findGroupByItemId(overId);

      if (!activeGroup || !overGroup) return prevGroups;

      const activeTeamIndex =
        activeGroup.group_teams?.findIndex((t) => t.id === activeItemId) ?? -1;
      if (activeTeamIndex === -1) return prevGroups;

      const activeTeam = activeGroup.group_teams![activeTeamIndex];

      // 같은 그룹 내에서 순서 변경
      if (activeGroup.id === overGroup.id) {
        const overTeamIndex =
          overGroup.group_teams?.findIndex((t) => t.id === overId) ?? -1;
        if (overTeamIndex === -1) return prevGroups;

        const newGroups = prevGroups.map((g) => {
          if (g.id === activeGroup.id) {
            const newTeams = [...(g.group_teams || [])];
            const [removed] = newTeams.splice(activeTeamIndex, 1);
            newTeams.splice(overTeamIndex, 0, removed);
            return { ...g, group_teams: newTeams };
          }
          return g;
        });

        return newGroups;
      }

      // 다른 그룹으로 이동
      const newGroups = prevGroups.map((g) => {
        if (g.id === activeGroup.id) {
          return {
            ...g,
            group_teams: g.group_teams?.filter((t) => t.id !== activeItemId),
          };
        }
        if (g.id === overGroup.id) {
          const newTeams = [...(g.group_teams || [])];
          newTeams.push(activeTeam);
          return { ...g, group_teams: newTeams };
        }
        return g;
      });

      return newGroups;
    });

    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setActiveId(null);
  };

  const handleSave = async () => {
    try {
      const promises: Promise<{ error: unknown }>[] = [];

      localGroups.forEach((group) => {
        group.group_teams?.forEach((team) => {
          const originalGroup = groups.find((g) =>
            g.group_teams?.some((t) => t.id === team.id),
          );
          if (originalGroup && originalGroup.id !== group.id) {
            promises.push(moveTeamToGroup(team.id, group.id));
          }
        });
      });

      if (promises.length === 0) {
        setHasChanges(false);
        return;
      }

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        onError("일부 팀 이동에 실패했습니다.");
      }

      await onTeamMove?.();
      setHasChanges(false);
    } catch {
      onError("팀 이동 저장 중 오류가 발생했습니다.");
    }
  };

  const handleReset = () => {
    setLocalGroups(groups);
    setHasChanges(false);
  };

  // 시드 배정 모드 여부 (예선 없고 본선 생성 콜백이 있으면 시드 배정)
  const isSeedingMode = !hasPreliminary && !!onGenerateMainBracket;

  // 빈 그룹이 있고 2팀 이상인 그룹이 있으면 재배정 가능
  const canRedistribute = useMemo(() => {
    if (!isSeedingMode) return false;
    const hasEmpty = localGroups.some((g) => (g.group_teams?.length ?? 0) === 0);
    const hasMulti = localGroups.some((g) => (g.group_teams?.length ?? 0) >= 2);
    return hasEmpty && hasMulti;
  }, [isSeedingMode, localGroups]);

  // 자동 배정: 시드 폴드 배치 (상위 시드 BYE, 하위 시드끼리 대전)
  // 예) 5팀, 4그룹 → [S1] [S2] [S3,S6(없으면 빈)] [S4,S5]
  // → 상위 시드가 BYE로 자동 진출, 다음 라운드 빈 슬롯 최소화
  const handleAutoAssign = () => {
    const allTeams = localGroups
      .flatMap((g) => g.group_teams || [])
      .sort((a, b) => (a.seed_number ?? 0) - (b.seed_number ?? 0));

    const M = localGroups.length; // 그룹(매치) 수
    const N = allTeams.length;    // 팀 수

    const newGroups = localGroups.map((g, i) => {
      const groupTeams: GroupTeam[] = [];
      // Phase 1: 각 그룹에 시드 순 1명씩 배정
      if (i < N) {
        groupTeams.push(allTeams[i]);
      }
      // Phase 2: 남은 팀을 역순으로 배정 (상위 시드 vs 하위 시드)
      // 그룹 0 → 마지막 시드, 그룹 1 → 끝에서 두 번째, ...
      const secondIdx = M * 2 - 1 - i;
      if (secondIdx >= M && secondIdx < N) {
        groupTeams.push(allTeams[secondIdx]);
      }
      return { ...g, group_teams: groupTeams };
    });

    setLocalGroups(newGroups);
    setHasChanges(true);
  };

  // 드래그 중인 팀 찾기
  const activeTeam = activeId
    ? localGroups
        .flatMap((g) => g.group_teams || [])
        .find((t) => t.id === activeId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-(--text-primary)">
          {title}
          {hasChanges && (
            <span className="ml-2 text-sm text-amber-500">
              • 저장되지 않음
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {onAutoGenerate && (
            <button onClick={onAutoGenerate} className="btn-secondary btn-sm">
              <span className="relative z-10">자동 편성</span>
            </button>
          )}
          {isSeedingMode && canRedistribute && (
            <button
              onClick={handleAutoAssign}
              className="btn-outline-info btn-sm flex items-center gap-1.5"
            >
              <Shuffle className="w-4 h-4" />
              자동 배정
            </button>
          )}
          {localGroups.length > 0 && (
            <>
              {hasChanges && onTeamMove && (
                <>
                  <button
                    onClick={handleReset}
                    className="btn-outline-secondary"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-info"
                  >
                    저장하기
                  </button>
                </>
              )}
              {hasPreliminary ? (
                onGenerateMatches && (
                  <button
                    onClick={onGenerateMatches}
                    className="btn-primary btn-sm"
                  >
                    <span className="relative z-10">예선 경기 생성</span>
                  </button>
                )
              ) : (
                onGenerateMainBracket && (
                  <button
                    onClick={() => {
                      // 그룹별 2팀씩 null 패딩 → 그룹 경계 보존
                      // Group [T1,T2] → [T1,T2], Group [T3] → [T3,null]
                      const seedOrder = localGroups.flatMap((g) => {
                        const teams = g.group_teams || [];
                        const t1 = teams[0]?.entry_id ?? null;
                        const t2 = teams[1]?.entry_id ?? null;
                        return [t1, t2];
                      });
                      onGenerateMainBracket(seedOrder);
                    }}
                    className="btn-primary btn-sm"
                  >
                    <span className="relative z-10">{generateButtonLabel || "본선 대진표 생성"}</span>
                  </button>
                )
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="btn-outline-danger"
                >
                  조 편성 삭제
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {localGroups.length === 0 ? (
        <div className="text-center py-8 text-(--text-muted)">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>조 편성이 없습니다. 자동 편성 버튼을 클릭하세요.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {localGroups.map((group) => (
              <DroppableGroup key={group.id} group={group} />
            ))}
          </div>
          <DragOverlay>
            {activeId && activeTeam ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-(--bg-secondary) border-2 border-(--accent-color) shadow-2xl opacity-90">
                <GripVertical className="w-4 h-4 text-(--text-muted) flex-shrink-0" />
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-(--accent-color)/20 text-(--accent-color) text-xs font-bold flex-shrink-0">
                  •
                </span>
                <div className="flex-1 min-w-0">
                  {activeTeam.entry?.club_name && (
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {activeTeam.entry.club_name}
                    </p>
                  )}
                  <p
                    className={`truncate ${activeTeam.entry?.club_name ? "text-xs text-(--text-muted)" : "text-sm font-medium text-(--text-primary)"}`}
                  >
                    {activeTeam.entry?.player_name}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// Droppable 조 컴포넌트
function DroppableGroup({ group }: { group: PreliminaryGroup }) {
  const teamIds = group.group_teams?.map((t) => t.id) || [];

  const { setNodeRef } = useSortable({
    id: group.id,
    data: {
      type: "group",
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="p-4 rounded-xl border border-(--border-color) bg-(--bg-card) transition-all"
    >
      <h4 className="font-display font-semibold text-(--text-primary) mb-3">
        {group.name}조
      </h4>
      <SortableContext items={teamIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {group.group_teams?.map((team, index) => (
            <SortableTeam key={team.id} team={team} index={index} />
          ))}
          {(!group.group_teams || group.group_teams.length === 0) && (
            <div className="text-center py-4 text-(--text-muted) text-sm">
              팀을 여기로 드래그하세요
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Sortable 팀 컴포넌트
function SortableTeam({ team, index }: { team: GroupTeam; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: team.id,
    data: {
      type: "team",
      team,
    },
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-2 rounded-lg bg-(--bg-secondary) cursor-grab active:cursor-grabbing hover:bg-(--bg-card-hover)"
    >
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-(--accent-color)/20 text-(--accent-color) text-xs font-bold flex-shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        {team.entry?.partner_data ? (
          // 복식: 파트너 이름만 표시 (클럽명 제외)
          <p className="text-sm font-medium text-(--text-primary) truncate">
            {team.entry.player_name} & {team.entry.partner_data.name}
          </p>
        ) : (
          // 단식/단체전: 기존 형식 유지
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
