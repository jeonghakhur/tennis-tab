"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import type { BracketMatch } from "./types";
import type { DivisionEntry } from "@/lib/bracket/actions";

interface ChangeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: BracketMatch | null;
  slot: 1 | 2 | null;
  entries: DivisionEntry[];
  isTeamMatch?: boolean;
  onConfirm: (matchId: string, slot: 1 | 2, newEntryId: string) => void;
}

function getEntryLabel(entry: DivisionEntry, isTeamMatch?: boolean): string {
  if (entry.partner_data) {
    const club = entry.club_name || entry.partner_data.club || "";
    const clubPart = club ? `[${club}] ` : "";
    return `${clubPart}${entry.player_name} & ${entry.partner_data.name}`;
  }
  if (isTeamMatch) {
    const order = entry.team_order ? ` (${entry.team_order}팀)` : "";
    return `${entry.club_name || entry.player_name}${order}`;
  }
  return entry.club_name
    ? `[${entry.club_name}] ${entry.player_name}`
    : entry.player_name;
}

export function ChangeEntryModal({
  isOpen,
  onClose,
  match,
  slot,
  entries,
  isTeamMatch,
  onConfirm,
}: ChangeEntryModalProps) {
  if (!match || !slot) return null;

  const currentEntryId =
    slot === 1 ? match.team1_entry_id : match.team2_entry_id;
  const isCompleted = match.status === "COMPLETED";

  const handleSelect = (entryId: string) => {
    onConfirm(match.id, slot, entryId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`참가자 교체 — ${slot === 1 ? "팀 1" : "팀 2"}`}
      description={`경기 #${match.match_number}`}
      size="md"
    >
      <Modal.Body>
        <div className="space-y-3">
          {isCompleted && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-(--color-warning-subtle) border border-(--color-warning-border)">
              <AlertTriangle className="w-4 h-4 text-(--color-warning) shrink-0 mt-0.5" />
              <p className="text-sm text-(--color-warning) font-medium">
                결과가 입력된 경기입니다. 참가자 교체 시 이후 라운드 경기
                결과가 초기화됩니다.
              </p>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-(--border-color) divide-y divide-(--border-color)">
            {entries.map((entry) => {
              const isCurrent = entry.id === currentEntryId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelect(entry.id)}
                  disabled={isCurrent}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    isCurrent
                      ? "bg-(--color-success-subtle) text-(--color-success) cursor-default font-medium"
                      : "hover:bg-(--bg-card-hover) text-(--text-primary)"
                  }`}
                >
                  <span className="block truncate">
                    {getEntryLabel(entry, isTeamMatch)}
                  </span>
                  {isCurrent && (
                    <span className="text-sm text-(--color-success) opacity-70">
                      현재 배정됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-sm font-medium hover:bg-(--bg-card-hover) transition-colors"
        >
          취소
        </button>
      </Modal.Footer>
    </Modal>
  );
}
