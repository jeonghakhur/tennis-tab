"use client";

import { useState } from "react";
import { Check, MapPin, MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BracketMatch } from "./types";

interface MatchRowProps {
  match: BracketMatch;
  onResult?: (matchId: string, team1Score: number, team2Score: number) => void;
  /** 점수 없이 승자 직접 지정 (관리자 전용) */
  onSetWinner?: (matchId: string, winnerEntryId: string) => void;
  onTieWarning: () => void;
  isTeamMatch?: boolean;
  onOpenDetail?: (match: BracketMatch) => void;
  // 코트 정보 (controlled — 부모가 상태 관리)
  courtLocation?: string;
  courtNumber?: string;
  onCourtChange?: (matchId: string, field: "location" | "number", value: string) => void;
  /**
   * 목록 모드 — 카드 박스 제거, 평면 행으로 표시 (구분선은 부모의 divide-y로).
   * true면 승자가 좌측(첫 번째)에 오도록 정렬도 적용.
   */
  listMode?: boolean;
}

export function MatchRow({
  match,
  onResult,
  onSetWinner,
  onTieWarning,
  isTeamMatch,
  onOpenDetail,
  courtLocation,
  courtNumber,
  onCourtChange,
  listMode,
}: MatchRowProps) {
  const [winnerMenuOpen, setWinnerMenuOpen] = useState(false);
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

  // 표시 순서: 결과 확정된 매치는 승자가 좌측(첫 번째), 패자가 우측(두 번째)
  // 편집 모드에서는 데이터 매핑(team1Score state)과 일치하도록 swap 안 함
  const swapped =
    !editing &&
    !!match.winner_entry_id &&
    match.winner_entry_id === match.team2_entry_id;
  const firstLabel = swapped ? team2Label : team1Label;
  const secondLabel = swapped ? team1Label : team2Label;
  const firstScore = swapped ? match.team2_score : match.team1_score;
  const secondScore = swapped ? match.team1_score : match.team2_score;
  const firstEntryId = swapped ? match.team2_entry_id : match.team1_entry_id;
  const secondEntryId = swapped ? match.team1_entry_id : match.team2_entry_id;
  const firstIsWinner = !!match.winner_entry_id && match.winner_entry_id === firstEntryId;
  const secondIsWinner = !!match.winner_entry_id && match.winner_entry_id === secondEntryId;

  if (match.status === "BYE") {
    return (
      <div
        className={
          listMode
            ? "flex items-center gap-3 px-2 py-2.5"
            : "flex items-center gap-3 p-3 rounded-xl bg-(--bg-secondary) border border-(--border-color)"
        }
      >
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

  // 컨테이너 styling: listMode는 평면 행, 아니면 카드
  const containerClass = listMode
    ? "overflow-hidden"
    : `rounded-xl border overflow-hidden ${
        match.status === "COMPLETED"
          ? "bg-(--color-success-subtle) border-(--color-success-border)"
          : "bg-(--bg-secondary) border-(--border-color)"
      }`;
  const matchRowPadding = listMode ? "px-2 py-2.5" : "p-3";

  return (
    <div className={containerClass}>
      {/* 매치 정보 행 */}
      <div className={`flex items-center gap-3 ${matchRowPadding}`}>
        <span className="text-sm text-(--text-muted) w-8">
          #{match.match_number}
        </span>

        {/* 첫 번째 팀 (결과 확정 시 승자) */}
        <div
          className={`flex-1 text-right ${
            firstIsWinner
              ? "font-bold text-(--color-success)"
              : "text-(--text-primary)"
          }`}
        >
          <span className="text-sm">{firstLabel}</span>
        </div>

        {/* Score — 편집 중: 입력 필드 / 승자 직접 지정(score null+winner): "승" 표시 / 그 외: 점수 */}
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
        ) : match.team1_score === null && match.team2_score === null && match.winner_entry_id ? (
          <span className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            승자 지정
          </span>
        ) : (
          <div className="flex items-center gap-1 px-3 py-1 font-mono text-sm text-(--text-primary)">
            <span>{firstScore ?? "-"}</span>
            <span className="text-(--text-muted)">:</span>
            <span>{secondScore ?? "-"}</span>
          </div>
        )}

        {/* 두 번째 팀 (결과 확정 시 패자) */}
        <div
          className={`flex-1 text-left ${
            secondIsWinner
              ? "font-bold text-(--color-success)"
              : "text-(--text-primary)"
          }`}
        >
          <span className="text-sm">{secondLabel}</span>
        </div>

        {/* 액션 버튼 — 우측 고정 */}
        {isTeamMatch && onOpenDetail ? (
          <button
            onClick={() => onOpenDetail(match)}
            disabled={!onResult || !match.team1_entry_id || !match.team2_entry_id}
            className={`shrink-0 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              !(onResult && match.team1_entry_id && match.team2_entry_id)
                ? "opacity-40 cursor-not-allowed bg-(--bg-card) text-(--text-muted)"
                : match.team1_score !== null || match.winner_entry_id
                  ? "bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {match.team1_score !== null || match.winner_entry_id ? "수정" : "점수 입력"}
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
                : match.team1_score !== null || match.winner_entry_id
                  ? "bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {match.team1_score !== null || match.winner_entry_id ? "수정" : "점수 입력"}
          </button>
        )}

        {/* 승자 직접 지정 메뉴 — 양 팀 배정됨 + 편집 모드 아닐 때 */}
        {onSetWinner && !editing && match.team1_entry_id && match.team2_entry_id && (
          <Popover open={winnerMenuOpen} onOpenChange={setWinnerMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="승자 직접 지정"
                title="점수 없이 승자 지정"
                className="shrink-0 p-1.5 rounded-lg text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary) transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <div className="px-2 py-1.5 text-xs text-(--text-muted)">
                승자 지정 (점수 없이)
              </div>
              <button
                type="button"
                onClick={() => {
                  setWinnerMenuOpen(false);
                  onSetWinner(match.id, match.team1_entry_id!);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-(--bg-card-hover) text-(--text-primary) truncate"
              >
                {team1Label} 승
              </button>
              <button
                type="button"
                onClick={() => {
                  setWinnerMenuOpen(false);
                  onSetWinner(match.id, match.team2_entry_id!);
                }}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-(--bg-card-hover) text-(--text-primary) truncate"
              >
                {team2Label} 승
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* 코트 정보 — 항상 입력 가능 (부모가 상태 관리) */}
      {onCourtChange && (
        <div
          className={
            listMode
              ? "px-2 pb-2.5 pl-12"
              : "border-t border-(--border-color)/50 px-3 py-2"
          }
        >
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
