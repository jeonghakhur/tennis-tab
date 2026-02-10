"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import type { BracketMatch } from "./types";

interface MatchRowProps {
  match: BracketMatch;
  onResult: (matchId: string, team1Score: number, team2Score: number) => void;
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
    onResult(match.id, s1, s2);
    setEditing(false);
  };

  // 복식: 파트너 이름만 (클럽명 제외), 단체전: 팀명, 단식: 클럽명 + 선수명
  const getTeamLabel = (team: BracketMatch['team1'] | BracketMatch['team2']) => {
    if (!team) return "TBD";

    if (team.partner_data) {
      return `${team.player_name} & ${team.partner_data.name}`;
    }

    if (isTeamMatch) {
      return team.club_name || team.player_name || "TBD";
    }

    return team.club_name
      ? `${team.club_name} ${team.player_name}`
      : team.player_name || "TBD";
  };

  const team1Label = getTeamLabel(match.team1);
  const team2Label = getTeamLabel(match.team2);

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
      className={`rounded-xl border overflow-hidden ${
        match.status === "COMPLETED"
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-(--bg-secondary) border-(--border-color)"
      }`}
    >
      {/* 매치 정보 행 */}
      <div className="flex items-center gap-3 p-3">
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

        {/* Score — 단체전이면 모달 트리거 */}
        {isTeamMatch && onOpenDetail ? (
          <button
            onClick={() => onOpenDetail(match)}
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
        ) : editing ? (
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
