"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import type { BracketMatch } from "./types";

interface MatchRowProps {
  match: BracketMatch;
  onResult?: (matchId: string, team1Score: number, team2Score: number) => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
  // 코트 정보 (controlled — 부모가 상태 관리)
  courtLocation?: string;
  courtNumber?: string;
  onCourtChange?: (matchId: string, field: "location" | "number", value: string) => void;
}

export function MatchRow({
  match,
  onResult,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  courtLocation,
  courtNumber,
  onCourtChange,
}: MatchRowProps) {
  const [team1Score, setTeam1Score] = useState(
    match.team1_score?.toString() || "",
  );
  const [team2Score, setTeam2Score] = useState(
    match.team2_score?.toString() || "",
  );
  const [editing, setEditing] = useState(false);

  const handleSubmit = () => {
    const s1 = parseInt(team1Score) || 0;
    const s2 = parseInt(team2Score) || 0;
    if (s1 === s2) {
      onTieWarning();
      return;
    }
    onResult?.(match.id, s1, s2);
    setEditing(false);
  };

  // 복식: 파트너 이름만 (클럽명 제외), 단체전: 팀명, 단식: 클럽명 + 선수명
  const getTeamLabel = (team: BracketMatch['team1'] | BracketMatch['team2']) => {
    if (!team) return "TBD";

    if (team.partner_data) {
      return `${team.player_name} & ${team.partner_data.name}`;
    }

    // 팀 순번 접미사 (가팀, 나팀 등)
    const orderSuffix = team.team_order ? `(${team.team_order}팀)` : "";

    if (isTeamMatch) {
      const label = team.club_name || team.player_name || "TBD";
      return orderSuffix ? `${label} ${orderSuffix}` : label;
    }

    return team.club_name
      ? `${team.club_name}${orderSuffix ? ` ${orderSuffix}` : ""} ${team.player_name}`
      : team.player_name || "TBD";
  };

  const team1Label = getTeamLabel(match.team1);
  const team2Label = getTeamLabel(match.team2);

  if (match.status === "BYE") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-secondary) border border-(--border-color)">
        <span className="text-sm text-(--text-muted)">
          #{match.match_number}
        </span>
        <div className="flex-1">
          <span className="text-sm text-(--text-primary)">{team1Label}</span>
          <span className="ml-2 text-sm text-(--text-muted)">(부전승)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        match.status === "COMPLETED"
          ? "bg-(--color-success-subtle) border-(--color-success-border)"
          : "bg-(--bg-secondary) border-(--border-color)"
      }`}
    >
      {/* 매치 정보 행 */}
      <div className="flex items-center gap-3 p-3">
        <span className="text-sm text-(--text-muted) w-8">
          #{match.match_number}
        </span>

        {/* Team 1 */}
        <div
          className={`flex-1 text-right ${
            match.winner_entry_id === match.team1_entry_id
              ? "font-bold text-(--color-success)"
              : "text-(--text-primary)"
          }`}
        >
          <span className="text-sm">{team1Label}</span>
        </div>

        {/* Score — 개인전 편집 중이면 입력 필드, 아니면 점수 표시 */}
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
          </div>
        ) : (
          <div className="flex items-center gap-1 px-3 py-1 font-mono text-sm text-(--text-primary)">
            <span>{match.team1_score ?? "-"}</span>
            <span className="text-(--text-muted)">:</span>
            <span>{match.team2_score ?? "-"}</span>
          </div>
        )}

        {/* Team 2 */}
        <div
          className={`flex-1 text-left ${
            match.winner_entry_id === match.team2_entry_id
              ? "font-bold text-(--color-success)"
              : "text-(--text-primary)"
          }`}
        >
          <span className="text-sm">{team2Label}</span>
        </div>

        {/* 액션 버튼 — 우측 고정 */}
        {isTeamMatch && onOpenDetail ? (
          <button
            onClick={() => onOpenDetail(match)}
            disabled={!onResult || !match.team1_entry_id || !match.team2_entry_id}
            className={`shrink-0 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              !(onResult && match.team1_entry_id && match.team2_entry_id)
                ? "opacity-40 cursor-not-allowed bg-(--bg-card) text-(--text-muted)"
                : match.team1_score !== null
                  ? "bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {match.team1_score !== null ? "수정" : "점수 입력"}
          </button>
        ) : editing ? (
          <button
            onClick={handleSubmit}
            className="shrink-0 p-1.5 rounded-lg bg-(--color-success) text-white hover:bg-(--color-success-emphasis) transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => onResult && setEditing(true)}
            disabled={!onResult || !match.team1_entry_id || !match.team2_entry_id}
            className={`shrink-0 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              !(onResult && match.team1_entry_id && match.team2_entry_id)
                ? "opacity-40 cursor-not-allowed bg-(--bg-card) text-(--text-muted)"
                : match.team1_score !== null
                  ? "bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {match.team1_score !== null ? "수정" : "점수 입력"}
          </button>
        )}
      </div>

      {/* 코트 정보 — 항상 입력 가능 (부모가 상태 관리) */}
      {onCourtChange && (
        <div className="border-t border-(--border-color)/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-(--court-info) shrink-0" />
            <input
              type="text"
              value={courtLocation ?? ""}
              onChange={(e) => onCourtChange(match.id, "location", e.target.value)}
              placeholder="장소 (예: A구장)"
              className="flex-1 min-w-0 px-2.5 py-1 text-sm rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted)"
            />
            <input
              type="text"
              value={courtNumber ?? ""}
              onChange={(e) => onCourtChange(match.id, "number", e.target.value)}
              placeholder="코트 번호"
              className="w-24 px-2.5 py-1 text-sm rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
