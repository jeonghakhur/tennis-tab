"use client";

import { Switch } from "@/components/ui/switch";
import type { BracketConfig } from "./types";

interface SettingsTabProps {
  config: BracketConfig;
  groupCount?: number;
  teamCount?: number;
  onStartGrouping?: () => void;
  onUpdate?: (updates: Partial<BracketConfig>) => void;
  onDelete?: () => void;
}

export function SettingsTab({
  config,
  groupCount = 0,
  teamCount = 0,
  onStartGrouping,
  onUpdate,
  onDelete,
}: SettingsTabProps) {
  const readOnly = !onUpdate;

  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg font-semibold text-(--text-primary)">
        대진표 설정
      </h3>

      <div className="space-y-4">
        <label className={`flex items-center justify-between gap-3 ${readOnly ? '' : 'cursor-pointer'}`}>
          <span className="text-(--text-primary)">예선전 진행</span>
          <Switch
            checked={config.has_preliminaries}
            onCheckedChange={(checked) => onUpdate?.({ has_preliminaries: checked })}
            disabled={readOnly || config.status !== "DRAFT"}
          />
        </label>

        <div className="space-y-2">
          <label className="text-sm text-(--text-secondary)">조당 팀 수</label>
          {/* 세그먼트 컨트롤 */}
          <div
            className="inline-flex rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--border-color)" }}
          >
            {[2, 3].map((size) => {
              const isSelected = config.group_size === size;
              const isDisabled = readOnly || config.status !== "DRAFT";
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onUpdate?.({ group_size: size })}
                  disabled={isDisabled}
                  className="relative px-6 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isSelected ? "var(--accent-color)" : "transparent",
                    color: isSelected ? "var(--bg-primary)" : "var(--text-secondary)",
                  }}
                >
                  {size}팀
                </button>
              );
            })}
          </div>
          <p className="text-sm text-(--text-muted)">
            {config.group_size === 2
              ? config.has_preliminaries
                ? "각 조 2팀 시딩 경기 진행, 전원 본선 진출 (예선 승패로 본선 시드 결정)"
                : "각 조 2팀 배치, 조별 대진이 본선 1라운드 매치가 됩니다"
              : "각 조 3팀 풀리그 진행, 상위 2팀 본선 진출"}
          </p>
        </div>

        <label className={`flex items-center justify-between gap-3 ${readOnly ? '' : 'cursor-pointer'}`}>
          <span className="text-(--text-primary)">3/4위전 진행</span>
          <Switch
            checked={config.third_place_match}
            onCheckedChange={(checked) => onUpdate?.({ third_place_match: checked })}
            disabled={readOnly || config.status === "COMPLETED"}
          />
        </label>
      </div>

      <div className="pt-4 border-t border-(--border-color)">
        <div className="flex items-center gap-2">
          <span className="text-(--text-secondary)">상태:</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              config.status === "DRAFT"
                ? "bg-(--bg-card-hover) text-(--text-muted)"
                : config.status === "PRELIMINARY"
                  ? "bg-(--color-warning-subtle) text-(--color-warning)"
                  : config.status === "MAIN"
                    ? "bg-(--color-info-subtle) text-(--color-info)"
                    : "bg-(--color-success-subtle) text-(--color-success)"
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

      {/* 조편성 섹션 */}
      <div className="pt-4 border-t border-(--border-color)">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="font-medium text-(--text-primary)">조편성</h4>
            <p className="text-sm text-(--text-muted) mt-0.5">
              {groupCount > 0
                ? `${groupCount}개 조 · ${teamCount}팀 편성됨`
                : "아직 조편성이 없습니다."}
            </p>
          </div>
          {onStartGrouping && (
            <button onClick={onStartGrouping} className="btn-secondary btn-sm shrink-0">
              {groupCount > 0 ? "조편성 수정" : "조편성 시작"}
            </button>
          )}
        </div>
      </div>

      {onDelete && (
        <div className="pt-4 border-t border-(--border-color)">
          <button
            onClick={onDelete}
            className="btn-outline-danger"
          >
            전체 대진표 설정 삭제
          </button>
          <p className="text-xs text-(--text-muted) mt-2">
            모든 조 편성, 예선, 본선 데이터가 영구적으로 삭제되며, 대진표 설정이
            초기화됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
