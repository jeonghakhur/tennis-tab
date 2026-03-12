"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

  // ── 로컬 상태 (빠른 클릭 race condition 방지) ──
  const [localPrelim, setLocalPrelim] = useState(config.has_preliminaries);
  const [localGroupSize, setLocalGroupSize] = useState(config.group_size);
  const [localThirdPlace, setLocalThirdPlace] = useState(config.third_place_match);
  const pendingRef = useRef(0);

  // 서버 config가 바뀌었고, pending 업데이트가 없을 때만 동기화
  useEffect(() => {
    if (pendingRef.current === 0) {
      setLocalPrelim(config.has_preliminaries);
      setLocalGroupSize(config.group_size);
      setLocalThirdPlace(config.third_place_match);
    }
  }, [config.has_preliminaries, config.group_size, config.third_place_match]);

  const safeUpdate = useCallback(
    (updates: Partial<BracketConfig>) => {
      pendingRef.current += 1;
      onUpdate?.(updates);
      // 서버 응답 후 카운트 감소 (약 1초 후)
      setTimeout(() => {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
      }, 1500);
    },
    [onUpdate],
  );

  const handlePrelimChange = (checked: boolean) => {
    setLocalPrelim(checked);
    safeUpdate({ has_preliminaries: checked });
  };

  const handleGroupSizeChange = (size: number) => {
    setLocalGroupSize(size);
    safeUpdate({ group_size: size });
  };

  const handleThirdPlaceChange = (checked: boolean) => {
    setLocalThirdPlace(checked);
    safeUpdate({ third_place_match: checked });
  };

  const isDraft = config.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* ── 경기 방식 ── */}
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold text-(--text-primary)">
          경기 방식
        </h3>
        <p className="text-xs text-(--text-muted)">대진표 진행 방식을 설정합니다.</p>
      </div>

      <div className="space-y-3">
        {/* 예선전 */}
        <div
          className="rounded-xl p-4 transition-colors"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-(--text-primary)">예선전 진행</p>
              <p className="text-xs text-(--text-muted) mt-0.5">
                {localPrelim ? "조별 예선 후 본선 진출" : "예선 없이 바로 토너먼트"}
              </p>
            </div>
            <Switch
              checked={localPrelim}
              onCheckedChange={handlePrelimChange}
              disabled={readOnly || !isDraft}
            />
          </div>

          {/* 조당 팀 수 — 예선 ON일 때만 */}
          {localPrelim && (
            <div className="mt-4 pt-3 space-y-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <p className="text-xs font-medium text-(--text-secondary)">조당 팀 수</p>
              <div className="flex gap-2">
                {[2, 3].map((size) => {
                  const isSelected = localGroupSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleGroupSizeChange(size)}
                      disabled={readOnly || !isDraft}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                      style={{
                        backgroundColor: isSelected ? "var(--accent-color)" : "transparent",
                        color: isSelected ? "var(--bg-primary)" : "var(--text-muted)",
                        border: isSelected ? "1.5px solid transparent" : "1.5px solid var(--border-color)",
                      }}
                    >
                      {size}팀
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-(--text-muted)">
                {localGroupSize === 2
                  ? "각 조 2팀 시딩 경기, 전원 본선 진출"
                  : "각 조 3팀 풀리그, 상위 2팀 본선 진출"}
              </p>
            </div>
          )}
        </div>

        {/* 3/4위전 */}
        <div
          className="flex items-center justify-between rounded-xl p-4"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div>
            <p className="text-sm font-medium text-(--text-primary)">3/4위전 진행</p>
            <p className="text-xs text-(--text-muted) mt-0.5">
              {localThirdPlace ? "준결승 패자끼리 3위 결정전" : "3/4위전 없이 진행"}
            </p>
          </div>
          <Switch
            checked={localThirdPlace}
            onCheckedChange={handleThirdPlaceChange}
            disabled={readOnly || config.status === "COMPLETED"}
          />
        </div>
      </div>

      {/* ── 상태 ── */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div>
          <p className="text-sm font-medium text-(--text-primary)">현재 상태</p>
          {config.bracket_size && (
            <p className="text-xs text-(--text-muted) mt-0.5">
              본선 {config.bracket_size}강
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
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

      {/* ── 조편성 ── */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div>
          <p className="text-sm font-medium text-(--text-primary)">조편성</p>
          <p className="text-xs text-(--text-muted) mt-0.5">
            {groupCount > 0
              ? `${groupCount}개 조 · ${teamCount}팀 편성됨`
              : "아직 조편성이 없습니다"}
          </p>
        </div>
        {onStartGrouping && (
          <button
            type="button"
            onClick={onStartGrouping}
            className="text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-80"
            style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
          >
            {groupCount > 0 ? "조편성 수정" : "조편성 시작"}
          </button>
        )}
      </div>

      {/* ── 삭제 ── */}
      {onDelete && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-sm font-medium py-2.5 rounded-xl transition-colors text-red-500 hover:bg-red-500/10"
            style={{ border: "1px solid rgba(239,68,68,0.3)" }}
          >
            전체 대진표 설정 삭제
          </button>
          <p className="text-xs text-(--text-muted) mt-2 text-center">
            모든 조 편성·예선·본선 데이터가 영구 삭제됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
