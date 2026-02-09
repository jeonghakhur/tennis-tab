"use client";

import type { BracketConfig } from "./types";

interface SettingsTabProps {
  config: BracketConfig;
  onUpdate: (updates: Partial<BracketConfig>) => void;
  onDelete: () => void;
}

export function SettingsTab({ config, onUpdate, onDelete }: SettingsTabProps) {
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
