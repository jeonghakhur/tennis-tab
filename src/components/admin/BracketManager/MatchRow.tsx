"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { BracketMatch } from "./types";

interface MatchRowProps {
  match: BracketMatch;
  onResult: (matchId: string, team1Score: number, team2Score: number) => void;
  onTieWarning: () => void;
}

export function MatchRow({ match, onResult, onTieWarning }: MatchRowProps) {
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
    </div>
  );
}
